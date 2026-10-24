package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	tokenableType = "users"
	tokenName     = "auth_token"
)

var ErrInvalidToken = errors.New("token tidak valid")

func HashPassword(password string, cost int) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func CheckPassword(hash, password string) bool {
	if hash == "" {
		return false
	}

	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func IssueToken(db *gorm.DB, user *models.User) (string, error) {
	plain := rand.Text() + rand.Text()

	token := models.PersonalAccessToken{
		TokenableType: tokenableType,
		TokenableID:   user.UserID,
		Name:          tokenName,
		Token:         digest(plain),
	}

	if err := db.Create(&token).Error; err != nil {
		return "", fmt.Errorf("gagal membuat token: %w", err)
	}

	return fmt.Sprintf("%d|%s", token.ID, plain), nil
}

func Resolve(db *gorm.DB, bearer string) (*models.User, *models.PersonalAccessToken, error) {
	idPart, plain, ok := strings.Cut(bearer, "|")
	if !ok || plain == "" {
		return nil, nil, ErrInvalidToken
	}

	id, err := strconv.ParseUint(idPart, 10, 64)
	if err != nil {
		return nil, nil, ErrInvalidToken
	}

	var token models.PersonalAccessToken
	if err := db.Where("id = ? AND tokenable_type = ?", id, tokenableType).First(&token).Error; err != nil {
		return nil, nil, ErrInvalidToken
	}

	if subtle.ConstantTimeCompare([]byte(token.Token), []byte(digest(plain))) != 1 {
		return nil, nil, ErrInvalidToken
	}

	now := time.Now().UTC()
	if token.ExpiresAt != nil && token.ExpiresAt.Before(now) {
		return nil, nil, ErrInvalidToken
	}

	var user models.User
	if err := db.First(&user, token.TokenableID).Error; err != nil {
		return nil, nil, ErrInvalidToken
	}

	db.Model(&token).UpdateColumn("last_used_at", now)

	return &user, &token, nil
}

func Revoke(db *gorm.DB, token *models.PersonalAccessToken) error {
	return db.Delete(token).Error
}

func digest(plain string) string {
	sum := sha256.Sum256([]byte(plain))

	return hex.EncodeToString(sum[:])
}

func RevokeAll(db *gorm.DB, userID uint) error {
	return db.Where("tokenable_type = ? AND tokenable_id = ?", tokenableType, userID).Delete(&models.PersonalAccessToken{}).Error
}
