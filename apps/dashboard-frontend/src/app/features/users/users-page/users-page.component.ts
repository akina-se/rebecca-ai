import { Component } from '@angular/core';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.css'
})
export class UsersPageComponent {
  mockAlert(msg: string) {
    alert(msg);
  }
}
