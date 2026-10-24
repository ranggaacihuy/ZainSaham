package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
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
		serverError(c, err)
		return
	}

	token, err := auth.IssueToken(s.db, &user)
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

	var user models.User
	err := s.db.Where("email = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&user).Error
	if err != nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		fail(c, http.StatusUnauthorized, "Email atau kata sandi salah.")
		return
	}

	token, err := auth.IssueToken(s.db, &user)
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Berhasil masuk.", gin.H{"user": user, "token": token})
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
