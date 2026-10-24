package httpapi

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

type profileRequest struct {
	Name                 string `json:"name" binding:"required,max=100"`
	Email                string `json:"email" binding:"required,email,max=150"`
	CurrentPassword      string `json:"current_password"`
	Password             string `json:"password" binding:"omitempty,min=8"`
	PasswordConfirmation string `json:"password_confirmation" binding:"eqfield=Password"`
}

type deleteAccountRequest struct {
	Password string `json:"password" binding:"required"`
}

func (s *Server) updateProfile(c *gin.Context) {
	var req profileRequest
	if !bind(c, &req) {
		return
	}

	user := currentUser(c)
	email := strings.ToLower(req.Email)
	changingEmail := email != user.Email
	changingPassword := req.Password != ""

	if changingEmail || changingPassword {
		if req.CurrentPassword == "" {
			validationError(c, "current_password", "Kata sandi saat ini wajib diisi untuk mengubah email atau kata sandi.")
			return
		}

		if !auth.CheckPassword(user.PasswordHash, req.CurrentPassword) {
			validationError(c, "current_password", "Kata sandi saat ini salah.")
			return
		}
	}

	if changingEmail {
		var count int64
		if err := s.db.Unscoped().Model(&models.User{}).
			Where("email = ? AND user_id <> ?", email, user.UserID).
			Count(&count).Error; err != nil {
			serverError(c, err)
			return
		}

		if count > 0 {
			validationError(c, "email", "Email sudah terdaftar.")
			return
		}
	}

	updates := map[string]any{"name": req.Name, "email": email}

	if changingPassword {
		hash, err := auth.HashPassword(req.Password, s.cfg.BcryptCost)
		if err != nil {
			serverError(c, err)
			return
		}
		updates["password_hash"] = hash
	}

	if err := s.db.Model(user).Updates(updates).Error; err != nil {
		serverError(c, err)
		return
	}

	var fresh models.User
	if err := s.db.First(&fresh, user.UserID).Error; err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Profil berhasil diperbarui.", fresh)
}

func (s *Server) deleteProfile(c *gin.Context) {
	var req deleteAccountRequest
	if !bind(c, &req) {
		return
	}

	user := currentUser(c)

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		validationError(c, "password", "Kata sandi salah.")
		return
	}

	archivedEmail := fmt.Sprintf("deleted-%d-%s", user.UserID, user.Email)
	if len(archivedEmail) > 150 {
		archivedEmail = archivedEmail[:150]
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := auth.RevokeAll(tx, user.UserID); err != nil {
			return err
		}

		if err := tx.Model(user).Update("email", archivedEmail).Error; err != nil {
			return err
		}

		return tx.Delete(user).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Akun berhasil dihapus.", nil)
}
