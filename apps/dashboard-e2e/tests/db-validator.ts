import { expect } from '@playwright/test';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'rebecca-ai-gal-local';
const FIRESTORE_URL = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export class DbValidator {
  
  /**
   * Fetches a document directly from the Firestore Emulator REST API.
   */
  async getDocument(collection: string, docId: string) {
    const url = `${FIRESTORE_URL}/${collection}/${docId}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch from DB: ${response.statusText}`);
    }
    const data = await response.json();
    return this.parseFirestoreData(data.fields);
  }

  /**
   * Parses the verbose Firestore REST API format into a standard JSON object.
   */
  private parseFirestoreData(fields: any): any {
    const result: any = {};
    for (const key in fields) {
      const type = Object.keys(fields[key])[0];
      const value = fields[key][type];
      
      switch (type) {
        case 'stringValue':
          result[key] = value;
          break;
        case 'integerValue':
          result[key] = parseInt(value, 10);
          break;
        case 'doubleValue':
          result[key] = parseFloat(value);
          break;
        case 'booleanValue':
          result[key] = value;
          break;
        case 'mapValue':
          result[key] = this.parseFirestoreData(value.fields);
          break;
        case 'arrayValue':
          result[key] = value.values ? value.values.map((v: any) => this.parseFirestoreData({ temp: v }).temp) : [];
          break;
        case 'nullValue':
          result[key] = null;
          break;
        case 'timestampValue':
          result[key] = value;
          break;
        default:
          result[key] = value;
      }
    }
    return result;
  }

  /**
   * Verifies that a post has been deleted from the database.
   */
  async verifyPostDeleted(postId: string) {
    const doc = await this.getDocument('timeline_history', postId);
    expect(doc, `Post ${postId} should be deleted from DB`).toBeNull();
  }

  /**
   * Verifies that a user's status matches the expected value in the database.
   */
  async verifyUserStatus(userId: string, expectedStatus: string) {
    const doc = await this.getDocument('users', userId);
    expect(doc, `User ${userId} should exist in DB`).not.toBeNull();
    expect(doc.status, `User ${userId} status should be ${expectedStatus}`).toBe(expectedStatus);
  }
}
