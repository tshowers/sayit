import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ProfileIntentCardComponent } from '../components/profile-intent-card/profile-intent-card.component';
import { NotificationService } from '../services/notification.service';
import { SayitTopbarComponent } from '../shared/sayit-topbar/sayit-topbar.component';

@Component( {
  selector: 'app-sayit-profile-editor',
  standalone: true,
  imports: [CommonModule, ProfileIntentCardComponent, SayitTopbarComponent],
  styles: [`.profile-editor-topbar { max-width: 1120px; margin: 0 auto; padding: 0 16px; }`],
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
