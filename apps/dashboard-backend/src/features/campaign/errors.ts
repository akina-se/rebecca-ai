/**
 * Base abstract domain error for Campaign Narrative Engine operations.
 */
export abstract class CampaignError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a targeted campaign entity does not exist.
 */
export class CampaignNotFoundError extends CampaignError {
  readonly statusCode = 404;
  readonly code = 'CAMPAIGN_NOT_FOUND';
}

/**
 * Thrown when incoming campaign data fails semantic or structural validation.
 */
export class CampaignValidationError extends CampaignError {
  readonly statusCode = 400;
  readonly code = 'CAMPAIGN_VALIDATION_ERROR';
}

/**
 * Thrown when an operation violates an invariant, such as overlapping active/scheduled date windows.
 */
export class CampaignConflictError extends CampaignError {
  readonly statusCode = 409;
  readonly code = 'CAMPAIGN_CONFLICT';
}
