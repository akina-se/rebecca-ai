import 'dotenv/config';
import { ProactiveNewsUseCase } from '../src/features/news/usecase';
import { GeminiSearchNewsProvider } from '../src/features/news/providers/geminiSearch';
import * as firestore from '../src/services/firestore';
import * as gemini from '../src/services/gemini';
import * as storage from '../src/services/storage';
import * as xApi from '../src/services/xApi';
import * as tasks from '../src/services/tasks';
import { AppDependencies } from '../src/types';
import { getActivePersona } from '@rebecca/persona';
import config from '../src/config';

// Mock external APIs for safe local testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(xApi as any).tweet = async (text: string, mediaIds?: string[]) => {
  console.log(`[MOCK TWEET]: ${text}`);
  if (mediaIds && mediaIds.length > 0) {
    console.log(`[MOCK TWEET MEDIA ATTACHED]: ${mediaIds.join(', ')}`);
  }
  return { data: { id: 'mock-tweet-id' } };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(xApi as any).uploadMedia = async (buffer: Buffer, mimeType: string) => {
  console.log(`[MOCK UPLOAD MEDIA]: Uploading ${mimeType} buffer of size ${buffer.length} bytes`);
  return 'mock-media-id-12345';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(firestore as any).saveTimelinePost = async (params: { text: string }) => {
  console.log(`[MOCK DB] Saved timeline post: ${params.text}`);
};

const run = async () => {
  console.log('=========================================');
  console.log(' 📰 News Post Batch (手動実行テスト)');
  console.log('=========================================');

  const persona = getActivePersona(config.persona.activeId);

  const deps: AppDependencies = {
    firestore,
    gemini,
    storage,
    xApi,
    tasks,
    persona,
  };

  try {
    const provider = new GeminiSearchNewsProvider();
    const useCase = new ProactiveNewsUseCase(deps, provider);
    const result = await useCase.execute();
    console.log('\n[結果]:', result);
  } catch (e) {
    console.error('Test failed:', e);
  }
};

run();
