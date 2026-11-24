package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg config.Database) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.Connection {
	case "sqlite":
		dsn, err := sqliteDSN(cfg.Database)
		if err != nil {
			return nil, err
		}
		dialector = sqlite.Open(dsn)
	case "mysql":
		dialector = mysql.Open(fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=UTC",
			cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database,
		))
	default:
		return nil, fmt.Errorf("DB_CONNECTION tidak dikenal: %q (pilih sqlite atau mysql)", cfg.Connection)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.New(log.New(os.Stdout, "", log.LstdFlags), logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
		}),
		NowFunc:        func() time.Time { return time.Now().UTC() },
		TranslateError: true,
	})
	if err != nil {
		return nil, fmt.Errorf("gagal membuka database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	if cfg.Connection == "sqlite" {
		sqlDB.SetMaxOpenConns(1)
	} else if cfg.MaxOpenConns > 0 {
		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	}

	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(models.All()...); err != nil {
		return fmt.Errorf("gagal migrasi database: %w", err)
	}

	return nil
}

func sqliteDSN(path string) (string, error) {
	if !strings.HasPrefix(path, "file:") && path != ":memory:" {
		if dir := filepath.Dir(path); dir != "." {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return "", fmt.Errorf("gagal membuat folder database: %w", err)
			}
		}
	}

	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}

	return path + separator + "_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", nil
}
