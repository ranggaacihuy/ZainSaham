package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const (
	loginMaxFailures = 10
	loginLockout     = 15 * time.Minute
)

type registerRequest struct {
	Name                 string `json:"name" binding:"required,max=100"`
	Email                string `json:"email" binding:"required,email,max=150"`
	Password             string `json:"password" binding:"required,min=8"`
	PasswordConfirmation string `json:"password_confirmation" binding:"required,eqfield=Password"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (s *Server) register(c *gin.Context) {
	var req registerRequest
	if !bind(c, &req) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	var count int64
	if err := s.db.Unscoped().Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		serverError(c, err)
		return
	}

	if count > 0 {
		validationError(c, "email", "Email sudah terdaftar.")
		return
	}

	hash, err := auth.HashPassword(req.Password, s.cfg.BcryptCost)
	if err != nil {
		serverError(c, err)
		return
	}

	user := models.User{Name: strings.TrimSpace(req.Name), Email: email, PasswordHash: hash}
	if err := s.db.Create(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			validationError(c, "email", "Email sudah terdaftar.")
			return
		}
		serverError(c, err)
		return
	}

	token, err := auth.IssueToken(s.db, &user, s.cfg.TokenTTL)
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusCreated, "Pendaftaran akun berhasil.", gin.H{"user": user, "token": token})
}

func (s *Server) login(c *gin.Context) {
	var req loginRequest
	if !bind(c, &req) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	limitKey := "login:" + email
	if s.loginLimiter.blocked(limitKey, time.Now()) {
		fail(c, http.StatusTooManyRequests, "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.")
		return
	}

	var user models.User
	err := s.db.Where("email = ?", email).First(&user).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		serverError(c, err)
		return
	}

	// Tetap jalankan bcrypt saat email tidak terdaftar supaya waktu respons
	// tidak membocorkan email mana yang ada.
	hash := user.PasswordHash
	if err != nil {
		hash = s.fakePasswordHash()
	}

	if !auth.CheckPassword(hash, req.Password) || err != nil {
		s.loginLimiter.allow(limitKey, time.Now())
		fail(c, http.StatusUnauthorized, "Email atau kata sandi salah.")
		return
	}

	s.loginLimiter.reset(limitKey)

	token, err := auth.IssueToken(s.db, &user, s.cfg.TokenTTL)
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Berhasil masuk.", gin.H{"user": user, "token": token})
}

func (s *Server) fakePasswordHash() string {
	s.dummyHashOnce.Do(func() {
		s.dummyHash, _ = auth.HashPassword("zainsaham-dummy-password", s.cfg.BcryptCost)
	})

	return s.dummyHash
}

func (s *Server) me(c *gin.Context) {
	ok(c, currentUser(c))
}

func (s *Server) logout(c *gin.Context) {
	if err := auth.Revoke(s.db, currentToken(c)); err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Berhasil keluar.", nil)
}
