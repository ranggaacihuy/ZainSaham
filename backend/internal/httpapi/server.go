package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/analysis"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"gorm.io/gorm"
)

type Server struct {
	db              *gorm.DB
	cfg             config.App
	market          *market.Service
	analysis        *analysis.Service
	intradayLimiter *rateLimiter
}

func NewServer(db *gorm.DB, cfg config.App, marketService *market.Service, analysisService *analysis.Service) *Server {
	registerValidation()

	return &Server{
		db:              db,
		cfg:             cfg,
		market:          marketService,
		analysis:        analysisService,
		intradayLimiter: newRateLimiter(45, time.Minute),
	}
}

func (s *Server) Router() *gin.Engine {
	router := gin.New()
	router.HandleMethodNotAllowed = true
	_ = router.SetTrustedProxies(nil)

	if gin.Mode() != gin.TestMode {
		router.Use(gin.Logger())
	}

	router.Use(gin.CustomRecovery(func(c *gin.Context, recovered any) {
		log.Printf("panic: %v", recovered)
		fail(c, http.StatusInternalServerError, "Terjadi kesalahan pada server.")
	}))
	router.Use(cors(s.cfg.CORSOrigins))

	router.NoRoute(func(c *gin.Context) { fail(c, http.StatusNotFound, "Endpoint tidak ditemukan.") })
	router.NoMethod(func(c *gin.Context) { fail(c, http.StatusMethodNotAllowed, "Metode tidak diizinkan.") })

	router.GET("/up", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := router.Group("/api")
	api.POST("/register", s.register)
	api.POST("/login", s.login)

	api.GET("/stocks", s.listStocks)
	api.GET("/compare", s.compareStocks)
	api.GET("/stocks/:stockId", s.showStock)
	api.GET("/stocks/:stockId/prices", s.stockPrices)
	api.GET("/stocks/:stockId/quote", s.stockQuote)
	api.GET("/stocks/:stockId/indicators", s.stockIndicators)
	api.GET("/stocks/:stockId/fundamentals", s.stockFundamentals)
	api.GET("/stocks/:stockId/news", s.stockNews)
	api.GET("/news", s.newsFeed)

	private := api.Group("", s.requireAuth)
	private.GET("/stocks/:stockId/intraday", s.rateLimitIntraday, s.stockIntraday)
	private.GET("/me", s.me)
	private.POST("/logout", s.logout)
	private.PUT("/profile", s.updateProfile)
	private.DELETE("/profile", s.deleteProfile)

	private.GET("/dashboard", s.dashboard)

	private.GET("/users/:userId/watchlist", s.listWatchlist)
	private.POST("/watchlists", s.addToWatchlist)
	private.DELETE("/watchlists/:watchlistId", s.removeFromWatchlist)

	private.GET("/stocks/:stockId/ai-analysis", s.listAnalyses)
	private.POST("/ai-analysis", s.createAnalysis)

	private.POST("/ai-chat", s.chat)
	private.GET("/ai-chat/:sessionId/messages", s.chatMessages)

	private.GET("/ai-sessions", s.listSessions)
	private.GET("/ai-sessions/:sessionId", s.showSession)
	private.DELETE("/ai-sessions/:sessionId", s.deleteSession)

	return router
	
}
