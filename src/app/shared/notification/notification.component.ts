import { Component, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css'
})
export class NotificationComponent implements AfterViewInit, OnDestroy {
  constructor(private notificationService: NotificationService) {}

  ngAfterViewInit(): void {
    this.notificationService.register(this);
  }

  ngOnDestroy(): void {
    this.notificationService.hide();
  }

  @Input() header: string = '';
  @Input() description: string = '';
  @Input() type: 'success' | 'error' | 'warning' | 'info' = 'success';
  show: boolean = false;

  display(header: string, description: string, type: 'success' | 'error' | 'warning' | 'info') {
    this.header = header;
    this.description = description;
    this.type = type;
    this.show = true;

    setTimeout(() => {
      this.dismiss();
    }, 5000);
  }

  dismiss() {
    this.show = false;
  }
}
