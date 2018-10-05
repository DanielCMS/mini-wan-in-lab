import { Component } from '@angular/core';
import { MessageType, FeedbackService } from './feedback.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  constructor(private feedback: FeedbackService) {
  }

  private MessageType = MessageType;

}
