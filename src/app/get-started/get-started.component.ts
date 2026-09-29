import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { AuthContextService } from '../services/auth-context.service';
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  INTENT_OPTIONS,
  POST_MAX_LENGTH,
  SayItIntent,
  SayItOnboardingDraft,
  SayItOnboardingService,
  TOPIC_OPTIONS,
} from '../services/sayit-onboarding.service';

type StepKey = 'intent' | 'topic' | 'category' | 'post' | 'firstName' | 'lastName' | 'business' | 'signIn';

interface Step {
  key: StepKey;
  section: number;
  question: string;
  hint: string;
  optional?: boolean;
}

/**
 * Pre-sign-in wizard: the visitor writes their first post (every answer
 * has a default, so it's mostly taps), says who's posting it, and only then
 * signs in - which publishes the post (SayItOnboardingService). Same shape
 * as Network's /get-started: one question per screen under a 4-segment bar
 * whose first segment ("Start") is already done.
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'answerInput' ) answerInput?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  readonly sections = ['Start', 'Your post', 'About you', 'Sign in'];

  readonly steps: Step[] = [
    { key: 'intent', section: 1, question: 'What brings you to Say It?', hint: "You'll write your first post in under a minute." },
    { key: 'topic', section: 1, question: '', hint: 'Pick the closest fit.' },
    { key: 'category', section: 1, question: 'Which industry?', hint: 'So the right businesses see it.' },
    { key: 'post', section: 1, question: "Here's your post", hint: 'We wrote it from your answers. Make it yours, or keep it.' },
    { key: 'firstName', section: 2, question: "What's your first name?", hint: 'People see who they are talking to.' },
    { key: 'lastName', section: 2, question: 'And your last name?', hint: '' },
    { key: 'business', section: 2, question: "What's your business called?", hint: 'Shown with your name, like "Ada at Analytical Co".', optional: true },
    { key: 'signIn', section: 3, question: 'Last step: sign in to post it', hint: 'Your post goes live as soon as you sign in.' },
  ];

  readonly intentOptions = INTENT_OPTIONS;
  readonly categories = CATEGORY_OPTIONS;
  readonly maxLength = POST_MAX_LENGTH;
  readonly categoryLabel = categoryLabel;

  draft!: SayItOnboardingDraft;
  stepIndex = 0;
  categoryListOpen = false;
  isSigningIn = false;

  constructor (
    private readonly route: ActivatedRoute,
    private readonly title: Title,
    private readonly authService: AuthContextService,
    private readonly onboarding: SayItOnboardingService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started - Say It' );
    this.draft = this.onboarding.load();
    this.focusAnswer();
  }

  get step (): Step {
    return this.steps[this.stepIndex];
  }

  get questionText (): string {
    if ( this.step.key === 'topic' ) {
      return this.draft.intent === 'looking' ? 'What are you looking for?' : 'What are you offering?';
    }
    return this.step.question;
  }

  get topicOptions (): string[] {
    return TOPIC_OPTIONS[this.draft.intent];
  }

  get hasCustomTopic (): boolean {
    return !this.topicOptions.includes( this.draft.topic );
  }

  get isTextStep (): boolean {
    return ['firstName', 'lastName', 'business'].includes( this.step.key )
      || ( this.step.key === 'topic' && this.hasCustomTopic );
  }

  get textValue (): string {
    switch ( this.step.key ) {
      case 'topic': return this.draft.topic;
      case 'firstName': return this.draft.firstName;
      case 'lastName': return this.draft.lastName;
      case 'business': return this.draft.businessName;
      default: return '';
    }
  }

  set textValue ( value: string ) {
    switch ( this.step.key ) {
      case 'topic': this.draft.topic = value; this.refreshPost(); break;
      case 'firstName': this.draft.firstName = value; break;
      case 'lastName': this.draft.lastName = value; break;
      case 'business': this.draft.businessName = value; break;
    }
    this.persist();
  }

  get textAutocomplete (): string {
    switch ( this.step.key ) {
      case 'firstName': return 'given-name';
      case 'lastName': return 'family-name';
      case 'business': return 'organization';
      default: return 'off';
    }
  }

  get postRemaining (): number {
    return this.maxLength - this.draft.postText.trim().length;
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'topic': return !!this.draft.topic.trim();
      case 'post': return !!this.draft.postText.trim() && this.postRemaining >= 0;
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      default: return true;
    }
  }

  get previewName (): string {
    return this.draft.firstName.trim() ? this.onboarding.displayName( this.draft ) : 'You';
  }

  /** 0...1 fill of a progress segment - earlier sections full, the active one partial. */
  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  selectIntent ( intent: SayItIntent ): void {
    if ( this.draft.intent !== intent ) {
      this.draft.intent = intent;
      this.draft.topic = TOPIC_OPTIONS[intent][0];
      this.refreshPost();
      this.persist();
    }
  }

  selectTopic ( topic: string ): void {
    this.draft.topic = topic;
    this.refreshPost();
    this.persist();
  }

  selectOtherTopic (): void {
    if ( !this.hasCustomTopic ) {
      this.draft.topic = '';
      this.persist();
    }
    this.focusAnswer();
  }

  selectCategory ( category: string ): void {
    this.draft.category = category;
    this.categoryListOpen = false;
    this.refreshPost();
    this.persist();
  }

  onPostEdited ( value: string ): void {
    this.draft.postText = value;
    this.draft.postTextEdited = true;
    this.persist();
  }

  resetPost (): void {
    this.draft.postTextEdited = false;
    this.refreshPost();
    this.persist();
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signIn' ) {
      this.draft.readyToSubmit = true;
      this.persist();
    }
    this.focusAnswer();
  }

  skip (): void {
    this.next();
  }

  back (): void {
    if ( this.stepIndex > 0 ) {
      this.stepIndex--;
      this.focusAnswer();
    }
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( '/' );
  }

  persist (): void {
    this.onboarding.save( this.draft );
  }

  private refreshPost (): void {
    if ( !this.draft.postTextEdited ) {
      this.draft.postText = this.onboarding.suggestedPost( this.draft );
    }
  }

  private focusAnswer (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }
}
