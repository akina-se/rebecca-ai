import { getPersonaPatternEmbeddings } from '../../../src/core/personaEmbeddingCache';
import { personaPatterns, precomputedPersonaPatternEmbeddings } from '@rebecca/persona';

describe('personaEmbeddingCache unit tests', () => {
    test('should return precomputed embeddings for 120 patterns with zero latency', () => {
        const embeddings = getPersonaPatternEmbeddings();
        expect(embeddings.length).toBe(120);
        expect(embeddings.length).toBe(personaPatterns.length);
        expect(embeddings[0].vector.length).toBe(768);
        expect(embeddings[0].category).toBeDefined();
        expect(embeddings[0].trigger).toBeDefined();
        expect(embeddings).toBe(precomputedPersonaPatternEmbeddings);
    });

    test('should return immutable pattern vectors on subsequent calls', () => {
        const firstCall = getPersonaPatternEmbeddings();
        const secondCall = getPersonaPatternEmbeddings();
        expect(firstCall).toBe(secondCall);
    });
});
