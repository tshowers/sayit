import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ProfileIntentCardComponent } from '../components/profile-intent-card/profile-intent-card.component';
import { NotificationService } from '../services/notification.service';

@Component( {
  selector: 'app-sayit-profile-editor',
  standalone: true,
  imports: [CommonModule, ProfileIntentCardComponent],
  templateUrl: './sayit-profile-editor.component.html',
} )
export class SayitProfileEditorComponent {
  constructor (
    private readonly router: Router,
    private readonly notificationService: NotificationService,
  ) { }

  onCompleted (): void {
    this.notificationService.show(
      'Profile Saved',
      'Your SayIt profile has been updated.',
      'success'
    );
  }

  onClosed (): void {
    this.router.navigate( ['/'] );
  }
}
