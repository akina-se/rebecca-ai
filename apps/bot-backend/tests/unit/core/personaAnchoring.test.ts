import { resolveSituationalPersonaAnchors } from '../../../src/core/personaAnchoring';
import { IGeminiService } from '../../../src/types';

describe('personaAnchoring Unit Tests', () => {
  let mockGemini: jest.Mocked<IGeminiService>;

  beforeEach(() => {
    mockGemini = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
    } as unknown as jest.Mocked<IGeminiService>;
  });

  it('should return few-shot prompt for non-empty context elements', async () => {
    const result = await resolveSituationalPersonaAnchors(
      mockGemini,
      ['【時間帯】夜', '【近況】サーバーの冷却'],
      'ja',
      3
    );

    expect(mockGemini.generateEmbedding).toHaveBeenCalledWith(
      '【時間帯】夜\n【近況】サーバーの冷却'
    );
    expect(result).toContain('【動的Few-Shotペルソナアンカー');
  });

  it('should support english language', async () => {
    const result = await resolveSituationalPersonaAnchors(
      mockGemini,
      ['[Time Context] Night'],
      'en',
      2
    );

    expect(mockGemini.generateEmbedding).toHaveBeenCalledWith('[Time Context] Night');
    expect(result).toContain('[Dynamic Few-Shot Persona Anchors]');
  });

  it('should return empty string without calling gemini when elements are empty', async () => {
    const result = await resolveSituationalPersonaAnchors(
      mockGemini,
      ['', '   ', null as unknown as string],
      'ja'
    );

    expect(mockGemini.generateEmbedding).not.toHaveBeenCalled();
    expect(result).toBe('');
  });

  it('should return empty string if gemini returns empty vector', async () => {
    mockGemini.generateEmbedding.mockResolvedValueOnce([]);

    const result = await resolveSituationalPersonaAnchors(
      mockGemini,
      ['Some context'],
      'ja'
    );

    expect(result).toBe('');
  });

  it('should gracefully handle errors thrown by gemini.generateEmbedding', async () => {
    mockGemini.generateEmbedding.mockRejectedValueOnce(new Error('Embedding service unavailable'));

    const result = await resolveSituationalPersonaAnchors(
      mockGemini,
      ['Some context'],
      'ja'
    );

    expect(result).toBe('');
  });
});
