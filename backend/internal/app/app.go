package app

import (
	"github.com/ranggaacihuy/zainsaham/backend/internal/analysis"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/database"
	"github.com/ranggaacihuy/zainsaham/backend/internal/gemini"
	"github.com/ranggaacihuy/zainsaham/backend/internal/httpapi"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"gorm.io/gorm"
)

type App struct {
	Config   config.Config
	DB       *gorm.DB
	Market   *market.Service
	Analysis *analysis.Service
}

func New(cfg config.Config) (*App, error) {
	db, err := database.Open(cfg.Database)
	if err != nil {
		return nil, err
	}

	return &App{
		Config:   cfg,
		DB:       db,
		Market:   market.NewService(db, cfg.Yahoo, cfg.News),
		Analysis: analysis.NewService(db, gemini.New(cfg.Gemini)),
	}, nil
}

func (a *App) Server() *httpapi.Server {
	return httpapi.NewServer(a.DB, a.Config.App, a.Market, a.Analysis)
}

func (a *App) Close() {
	if sqlDB, err := a.DB.DB(); err == nil {
		_ = sqlDB.Close()
	}
}
