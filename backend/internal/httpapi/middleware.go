package httpapi

import (
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

type rateBucket struct {
	count int
	reset time.Time
}

type rateLimiter struct {
	mu         sync.Mutex
	buckets    map[string]rateBucket
	limit      int
	window     time.Duration
	maxBuckets int
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		buckets:    map[string]rateBucket{},
		limit:      limit,
		window:     window,
		maxBuckets: 2048,
	}
}

func (rl *rateLimiter) allow(key string, now time.Time) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if len(rl.buckets) >= rl.maxBuckets {
		for k, b := range rl.buckets {
			if !now.Before(b.reset) {
				delete(rl.buckets, k)
			}
		}
	}

	b, ok := rl.buckets[key]
	if !ok || !now.Before(b.reset) {
		rl.buckets[key] = rateBucket{count: 1, reset: now.Add(rl.window)}
		return true
	}

	if b.count >= rl.limit {
		return false
	}

	b.count++
	rl.buckets[key] = b
	return true
}

func (s *Server) rateLimitIntraday(c *gin.Context) {
	if s.intradayLimiter == nil {
		c.Next()
		return
	}

	key := "ip:" + c.ClientIP()
	if rawUser, exists := c.Get(userKey); exists {
		if user, ok := rawUser.(*models.User); ok && user != nil {
			key = "user:" + strconv.FormatUint(uint64(user.UserID), 10)
		}
	}

	if !s.intradayLimiter.allow(key, time.Now()) {
		fail(c, http.StatusTooManyRequests, "Terlalu banyak permintaan data intraday. Coba lagi sebentar.")
		return
	}

	c.Next()
}

const (
	userKey  = "user"
	tokenKey = "token"
)

func (s *Server) requireAuth(c *gin.Context) {
	bearer, found := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
	if !found || strings.TrimSpace(bearer) == "" {
		fail(c, http.StatusUnauthorized, "Sesi telah berakhir. Silakan masuk kembali.")
		return
	}

	user, token, err := auth.Resolve(s.db, strings.TrimSpace(bearer))
	if err != nil {
		fail(c, http.StatusUnauthorized, "Sesi telah berakhir. Silakan masuk kembali.")
		return
	}

	c.Set(userKey, user)
	c.Set(tokenKey, token)
	c.Next()
}

func currentUser(c *gin.Context) *models.User {
	return c.MustGet(userKey).(*models.User)
}

func currentToken(c *gin.Context) *models.PersonalAccessToken {
	return c.MustGet(tokenKey).(*models.PersonalAccessToken)
}

func ownsUserID(c *gin.Context, userID uint) bool {
	if currentUser(c).UserID != userID {
		fail(c, http.StatusForbidden, "Akses ditolak.")
		return false
	}

	return true
}

func cors(origins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin != "" && (slices.Contains(origins, "*") || slices.Contains(origins, origin)) {
			header := c.Writer.Header()
			header.Set("Access-Control-Allow-Origin", origin)
			header.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
			header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			header.Add("Vary", "Origin")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
