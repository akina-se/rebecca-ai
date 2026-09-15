import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import config from '../../config';
import { ProactiveNewsController } from './controller';
import { ProactiveNewsUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';
import { AppDependencies } from '../../types';
import { createProactiveNewsRouter } from './routes';
import { INewsProvider } from './types';
import { GeminiSearchNewsProvider } from './providers/geminiSearch';

export * from './types';
export * from './usecase';
export * from './controller';
export * from './routes';
export * from './providers/geminiSearch';

/**
 * Creates and configures the router module for the Proactive News feature.
 *
 * @param deps The application dependencies required to instantiate the use cases and controllers.
 * @param provider Optional custom news provider implementation (defaults to GeminiSearchNewsProvider).
 * @returns An Express Router instance configured with news-related routes.
 */
export const createProactiveNewsModule = (
  deps: AppDependencies,
  provider?: INewsProvider,
): Router => {
  const newsProvider = provider ?? new GeminiSearchNewsProvider(
    new GoogleGenAI({ apiKey: config.gemini.apiKey }),
    config.gemini.newsSearchModel,
  );
  const useCase = new ProactiveNewsUseCase(deps, newsProvider, {
    dedupLookbackDays: config.news.dedupLookbackDays,
    dedupSimilarityThreshold: config.news.dedupSimilarityThreshold,
    timezone: config.appTimezone,
  });
  const soliloquyUseCase = new SoliloquyUseCase(deps, { timezone: config.appTimezone });
  const controller = new ProactiveNewsController(useCase, soliloquyUseCase);
  return createProactiveNewsRouter(controller);
};