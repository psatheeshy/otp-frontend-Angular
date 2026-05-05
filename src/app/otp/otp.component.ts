import { Component, OnInit, ViewChildren, OnDestroy, QueryList, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss']
})
export class OtpComponent implements OnInit, OnDestroy {

  otpForm!: FormGroup;
  otpSent = false;
  loading = false;
  message = '';

  // Digit-box state
  otpBoxes = [0, 1, 2, 3, 4, 5];       // used for *ngFor
  otpDigits: string[] = ['', '', '', '', '', ''];
  otpError = false;                       // drives red border + alert
  tooManyAttempts = false;                  // locks UI after too many failures
  attemptCount = 0;
  readonly MAX_ATTEMPTS = 3;

  // Resend countdown
  resendCountdown = 120;
  private countdownInterval: any = null;

  @ViewChildren('otpRef') otpRefs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.otpForm = this.fb.nonNullable.group({
      phone: ['+91', [
        Validators.required,
        Validators.pattern(/^\+\d{10,15}$/)
      ]],
      otp: ['', [
        Validators.required,
        Validators.pattern(/^[0-9]{6}$/)
      ]]
    });
  }

  // ── Digit box handlers ──────────────────────────────────

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);   // digits only, 1 char
    this.otpDigits[index] = val;
    input.value = val;
    this.otpError = false;

    // Sync to form control
    this.otpForm.get('otp')?.setValue(this.otpDigits.join(''));

    // Auto-advance
    if (val && index < 5) {
      this.focusBox(index + 1);
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        this.otpDigits[index - 1] = '';
        this.focusBox(index - 1);
      } else {
        this.otpDigits[index] = '';
      }
      this.otpForm.get('otp')?.setValue(this.otpDigits.join(''));
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, i) => (this.otpDigits[i] = ch));
    this.otpForm.get('otp')?.setValue(this.otpDigits.join(''));
    this.focusBox(Math.min(pasted.length, 5));
  }

  private focusBox(index: number): void {
    const boxes = this.otpRefs.toArray();
    boxes[index]?.nativeElement.focus();
  }

  // ── Auth methods ────────────────────────────────────────

  sendOtp(): void {
    if (this.otpForm.get('phone')?.invalid) return;

    this.loading = true;
    const phone = this.otpForm.value.phone;

    this.authService.sendOtp(phone).subscribe({
      next: () => {
        this.loading = false;
        this.otpSent = true;
        this.otpError = false;
        this.startCountdown();
        this.otpDigits = ['', '', '', '', '', ''];
        this.message = '';
      },
      error: (err) => {
        this.loading = false;
        this.message = err.error?.message || 'Error sending OTP';
      }
    });
  }


  verifyOtp(): void {
    if (this.otpForm.invalid) return;

    this.loading = true;
    const { phone, otp } = this.otpForm.value;

    this.authService.verifyOtp(phone, otp).subscribe({
      next: (res) => {
        this.loading = false;
        this.otpError = false;
        this.message = 'OTP Verified ✅';
        this.router.navigate(['/home'])
        localStorage.setItem('token', res.token);
      },
      error: (err) => {
        this.loading = false;
        this.attemptCount++;
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          this.tooManyAttempts = true;
          this.otpError = false;
        } else {
          this.otpError = true;
        }
        this.message = err.error?.message || 'Invalid OTP';
      }
    });
  }

  get resendMinutes(): string {
    return String(Math.floor(this.resendCountdown / 60)).padStart(1, '0');
  }

  get resendSeconds(): string {
    return String(this.resendCountdown % 60).padStart(2, '0');
  }

  resendOtp(event: Event): void {
    event.preventDefault();
    // Reset error & attempt state so UI unlocks
    this.tooManyAttempts = false;
    this.attemptCount = 0;
    this.otpError = false;
    this.otpDigits = ['', '', '', '', '', ''];
    this.otpForm.get('otp')?.setValue('');
    this.sendOtp();
    this.startCountdown();
  }

  private startCountdown(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.resendCountdown = 120;
    this.countdownInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.resendCountdown = 0;
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  goBack(event: Event): void {
    event.preventDefault();
    this.otpSent = false;
    this.otpError = false;
    this.tooManyAttempts = false;
    this.attemptCount = 0;
    this.otpDigits = ['', '', '', '', '', ''];
    this.message = '';
    this.otpForm.get('otp')?.setValue('');
  }
}



