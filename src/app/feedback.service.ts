import { Injectable } from '@angular/core';

export enum MessageType {
  INFO,
  WARNING,
  ERROR
}

export class Message {
  constructor(public text: string, public type: MessageType) {}
}


@Injectable({
  providedIn: 'root'
})
export class FeedbackService {

  public messages: Message[] = [];

  constructor() { }

  public sendInfo(msg: string): void {
    this.messages.push(new Message(msg, MessageType.INFO));
  }

  public sendWarning(msg: string): void {
    this.messages.push(new Message(msg, MessageType.WARNING));
  }

  public sendError(msg: string): void {
    this.messages.push(new Message(msg, MessageType.ERROR));
  }

  public removeMsg(msg: Message): void {
    this.messages = this.messages.filter(_m => _m !== msg);
  }

}
