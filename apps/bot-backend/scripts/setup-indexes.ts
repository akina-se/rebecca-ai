/**
 * @fileoverview Automated setup script for Firestore indexes and TTL policies.
 * 
 * Configures all required composite indexes (vector search, complex queries)
 * and Time-to-Live (TTL) policies for the Rebecca AI database in GCP.
 * 
 * Usage:
 *   npm run setup:indexes
 */

import { execSync } from 'child_process';
import 'dotenv/config';

const projectId = process.env.GCP_PROJECT_ID;
const database = process.env.FIRESTORE_DATABASE || '(default)';

if (!projectId) {
    console.error('❌ Error: GCP_PROJECT_ID is not set in environment or .env');
    process.exit(1);
}

console.log(`=======================================================`);
console.log(` 🔥 Setting up Firestore Indexes for Project: ${projectId}`);
console.log(`=======================================================\n`);

interface IndexDefinition {
    collectionGroup: string;
    description: string;
    fields: {
        fieldPath: string;
        order?: 'ascending' | 'descending';
        vectorConfig?: { dimension: number; flat: Record<string, never> };
    }[];
}

const indexes: IndexDefinition[] = [
    {
        collectionGroup: 'images',
        description: 'Vector search for semantic image matching',
        fields: [
            {
                fieldPath: 'embedding',
                vectorConfig: { dimension: 768, flat: {} }
            }
        ]
    },
    {
        collectionGroup: 'rag_memories',
        description: 'User-scoped vector search for RAG memory retrieval',
        fields: [
            {
                fieldPath: 'userId',
                order: 'ascending'
            },
            {
                fieldPath: 'embedding',
                vectorConfig: { dimension: 768, flat: {} }
            }
        ]
    },
    {
        collectionGroup: 'rag_memories',
        description: 'User-scoped timestamp sorting for memory pruning',
        fields: [
            {
                fieldPath: 'userId',
                order: 'ascending'
            },
            {
                fieldPath: 'timestamp',
                order: 'ascending'
            }
        ]
    }
];

const ttlPolicies = [
    {
        collectionGroup: 'conversation_logs',
        field: 'expireAt',
        description: '5-year automatic expiration for raw conversation logs'
    },
    {
        collectionGroup: 'timeline_history',
        field: 'expireAt',
        description: '5-year automatic expiration for timeline post history'
    }
];

const createIndex = (idx: IndexDefinition) => {
    console.log(`📌 Processing Index: [${idx.collectionGroup}] - ${idx.description}...`);
    
    const fieldArgs = idx.fields.map(f => {
        if (f.vectorConfig) {
            return `--field-config="field-path=${f.fieldPath},vector-config={dimension=${f.vectorConfig.dimension},flat={}}"`;
        }
        return `--field-config="field-path=${f.fieldPath},order=${f.order || 'ascending'}"`;
    }).join(' ');

    const cmd = `gcloud firestore indexes composite create --project=${projectId} --database="${database}" --collection-group=${idx.collectionGroup} --query-scope=COLLECTION ${fieldArgs} --async`;

    try {
        execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(`  ✅ Index creation request issued successfully.`);
    } catch (e: any) {
        const stderr = e.stderr ? e.stderr.toString() : '';
        if (stderr.includes('ALREADY_EXISTS') || stderr.includes('already exists')) {
            console.log(`  ℹ️  Index already exists. Skipping.`);
        } else {
            console.warn(`  ⚠️ Warning/Note: ${stderr.trim() || e.message}`);
        }
    }
};

const setupTtl = (ttl: { collectionGroup: string; field: string; description: string }) => {
    console.log(`⏳ Setting up TTL Policy: [${ttl.collectionGroup}.${ttl.field}] - ${ttl.description}...`);
    const cmd = `gcloud firestore fields ttls update ${ttl.field} --collection-group=${ttl.collectionGroup} --project=${projectId} --database="${database}" --enable-ttl --async`;
    try {
        execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(`  ✅ TTL policy configured.`);
    } catch (e: any) {
        const stderr = e.stderr ? e.stderr.toString() : '';
        if (stderr.includes('ALREADY_EXISTS') || stderr.includes('already exists') || stderr.includes('TTL is already enabled')) {
            console.log(`  ℹ️  TTL policy already active. Skipping.`);
        } else {
            console.warn(`  ⚠️ Note: ${stderr.trim() || e.message}`);
        }
    }
};

console.log('--- 1. Composite & Vector Indexes ---');
indexes.forEach(createIndex);

console.log('\n--- 2. TTL (Time-To-Live) Policies ---');
ttlPolicies.forEach(setupTtl);

console.log('\n=======================================================');
console.log(' ✨ Firestore setup process completed.');
console.log(' Current index build statuses can be viewed with:');
console.log('   gcloud firestore indexes composite list');
console.log('=======================================================\n');
