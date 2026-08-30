import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

export type SayItIntentRole = 'buyer' | 'seller' | 'both' | 'unknown';
export type SayItIntentDomain =
  'real_estate' |
  'insurance' |
  'staffing' |
  'construction' |
  'professional_services' |
  'general';

export interface SayItIntentProfile {
  role: SayItIntentRole;
  domain: SayItIntentDomain;
  subIntents: string[];
  audienceTypes: string[];
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  inferredFrom: string[];
  summary: string;
}

export interface SayItRecommendationItem {
  label: string;
  query?: string;
  leadVaultQuery?: string;
}

export interface SayItProfileRecommendations {
  summary: string;
  recommendationType: 'lead_vault_segments' | 'provider_recommendations' | 'mixed' | 'none';
  nextActions: Array<{
    type: string;
    label: string;
    query: string;
  }>;
  leadVaultSegments: SayItRecommendationItem[];
  providerSuggestions: SayItRecommendationItem[];
}

export interface SayItProfileCompletionResponse {
  success: boolean;
  profile: {
    uid: string;
    email: string;
    displayName: string;
    businessName: string;
    businessCategory: string;
    intentText: string;
  };
  intentProfile: SayItIntentProfile;
  recommendations: SayItProfileRecommendations;
  seedStatus?: string | null;
  claimedProfile?: boolean;
}

@Injectable( {
  providedIn: 'root'
} )
export class SayItProfileApiService {
  private readonly baseUrl = environment.backendURL;

  constructor (
    private readonly http: HttpClient,
    private readonly logger: LoggerService,
  ) { }

  completeProfile ( payload: Record<string, unknown> ): Observable<SayItProfileCompletionResponse> {
    this.logger.info( '[SayIt] completeProfile request', {
      hasIntentText: !!String( payload['intentText'] || payload['sellText'] || '' ).trim(),
      businessCategory: String( payload['businessCategory'] || '' ).trim(),
    } );

    return this.http.post<SayItProfileCompletionResponse>(
      `${this.baseUrl}/sayit/profile/complete`,
      payload
    );
  }

  trackSeedEvent ( payload: { stage: string; email?: string; inviteId?: string; } ): Observable<{ success: boolean; tracked?: boolean; }> {
    return this.http.post<{ success: boolean; tracked?: boolean; }>(
      `${this.baseUrl}/sayit/seeding/track`,
      payload
    );
  }
}
