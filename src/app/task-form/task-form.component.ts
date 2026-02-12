import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule, RouterModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css']
})
export class TaskFormComponent implements OnInit {
  taskForm: FormGroup;
  employeeName: string = '';
  employeeId: string = '';

  expandedTaskIndex: number | null = 0;
  unratedTasks: any[] = [];
  currentMonthTasks: { [date: string]: any[] } = {};
  selectedTaskForEdit: any = null;
  showEditPopup: boolean = false;

  projects: string[] = [
    "Account, Card, Deposit, customer Onboarding",
    "Agent Banking",
    "Corporate Banking (Mobile)",
    "Icust",
    "Internet Banking (Retail & Corporate) ",
    "KIOSK",
    "LOS",
    "Median",
    "Mobile Banking ",
    "SIAS",
    "Teller",
    "Wallet Banking ",
    "Website"
  ];

// Base URL for backend
private readonly API_BASE_URL = 'https://emp-rating-backend.onrender.com';

// Filled dynamically from backend
teamLeads: string[] = [];

  alertMessage: string = '';
  showAlert: boolean = false;

  confirmMessage: string = '';
  showConfirm: boolean = false;
  confirmCallback: (() => void) | null = null;

  private isBrowser: boolean;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private activatedRouter: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.taskForm = this.fb.group({
      tasks: this.fb.array([this.createTask()])
    });
  }

  ngOnInit(): void {
    // ❗ Skip all side-effects when running on the server (SSR / prerender)
    if (!this.isBrowser) {
      return;
    }
  
    this.activatedRouter.queryParamMap.subscribe(params => {
      const empIdFromUrl = params.get('employeeId');
      let storedEmpId: string | null = null;
  
      if (this.isBrowser) {
        storedEmpId = localStorage.getItem('employeeId');
      }
  
      if (empIdFromUrl) {
        this.employeeId = empIdFromUrl;
        if (this.isBrowser) {
          localStorage.setItem('employeeId', empIdFromUrl);
        }
        this.loadEmployeeDetails(empIdFromUrl);
        this.loadCurrentMonthUnratedTasks(empIdFromUrl as string);
      } else if (storedEmpId) {
        this.employeeId = storedEmpId;
        this.loadEmployeeDetails(storedEmpId);
        this.loadCurrentMonthUnratedTasks(storedEmpId);
      } else {
        console.warn('⚠️ No employeeId found in URL or localStorage!');
      }
    });
  
    // If you added dynamic TL loading, keep it browser-only too
    // this.loadTeamLeads();
  }
  
    // ✅ load TL list from backend once
    this.loadTeamLeads();
  }

  private loadTeamLeads(): void {
    this.http.get<any[]>(`${this.API_BASE_URL}/api/fetchAll`)
      .subscribe({
        next: (res) => {
          // res is a list of Employee entities with employeeRole
          this.teamLeads = (res || [])
            .filter(emp => {
              const role = (emp.employeeRole || emp.role || '').toLowerCase();
              return role.includes('team lead'); // matches "Team Lead", "TEAM LEAD", etc.
            })
            .map(emp => emp.employeeName)
            .sort();
          console.log('Loaded team leads:', this.teamLeads);
        },
        error: (err) => {
          console.error('Error loading team leads:', err);
        }
      });
  }

  createTask(isFirst: boolean = false): FormGroup {
    return this.fb.group({
      taskId:[null],
      date: [isFirst ? '' : null, isFirst ? Validators.required : []],
      project: ['', Validators.required],
      teamLead: ['', Validators.required],
      taskTitle: ['', Validators.required],
      description: ['', Validators.required],
      reference: [''],
      prLink: [''],
      status: ['', Validators.required],
      hours: ['', Validators.required],
      extraHours: [''],
      file: [null]
    });
  }

  get tasks(): FormArray {
    return this.taskForm.get('tasks') as FormArray;
  }

  addTask(): void {
    this.tasks.push(this.createTask());
    this.expandedTaskIndex = this.tasks.length - 1;
  }

  removeTask(index: number): void {
    this.showCustomConfirm('Are you sure you want to delete this task?', () => {
      this.tasks.removeAt(index);
      if (this.expandedTaskIndex === index) {
        this.expandedTaskIndex = null;
      }
    });
  }

  toggleTask(index: number): void {
    this.expandedTaskIndex = this.expandedTaskIndex === index ? null : index;
  }

  onFileChange(event: any, index?: number): void {
    const file = event.target.files[0];
    if (file && index !== undefined) {
      this.tasks.at(index).get('file')?.setValue(file);
    } else if (index !== undefined) {
      this.tasks.at(index).get('file')?.setValue(null);
    }
  }

  loadEmployeeDetails(employeeId: string): void {
    this.http.get<any>(`https://emp-rating-backend.onrender.com/api/${employeeId}`)
      .subscribe({
        next: (res) => {
          this.employeeName = res.employeeName;
        },
        error: (err) => {
          console.error('Error fetching employee details:', err);
        }
      });
  }

  loadCurrentMonthUnratedTasks(employeeId: string): void {
    const currentDate = new Date();
    const yearMonth = currentDate.toISOString().slice(0, 7); 
    
    this.http.get<any>(`https://emp-rating-backend.onrender.com/api/v1/tasks/withoutrating/${employeeId}`)
      .subscribe({
        next: (res) => {
          this.unratedTasks = res.tasks || [];
          this.currentMonthTasks = this.groupTasksByDate(this.unratedTasks);
          console.log('📅 Current month unrated tasks:', this.currentMonthTasks);
        },
        error: (err) => {
          console.error('Error fetching current month unrated tasks:', err);
        }
      });
  }

  groupTasksByDate(tasks: any[]): { [date: string]: any[] } {
    const grouped: { [date: string]: any[] } = {};
    tasks.forEach(task => {
      const dateKey = new Date(task.workDate).toLocaleDateString('en-CA'); 
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(task);
    });
    return grouped;
  }

  getSortedDates(): string[] {
    return Object.keys(this.currentMonthTasks).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  formatDate(dateKey: string): string {
    return new Date(dateKey).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  hasCurrentMonthTasks(): boolean {
    return Object.keys(this.currentMonthTasks).length > 0;
  }

  onDateClick(dateKey: string): void {
    this.selectedTaskForEdit = {
      date: dateKey,
      tasks: [...this.currentMonthTasks[dateKey]] 
    };
    this.showEditPopup = true;
  }

  closeEditPopup(): void {
    this.showEditPopup = false;
    this.selectedTaskForEdit = null;
  }

  updateTaskInPopup(taskIndex: number, field: string, value: any): void {
    if (this.selectedTaskForEdit?.tasks[taskIndex]) {
      this.selectedTaskForEdit.tasks[taskIndex][field] = value;
    }
  }

  submitEditedTasks(): void {
  if (!this.selectedTaskForEdit || !this.employeeId || !this.selectedTaskForEdit.tasks.length) {
    this.showCustomAlert('No tasks selected for editing!');
    return;
  }

    const updatePromises: Promise<any>[] = [];
  
  this.selectedTaskForEdit.tasks.forEach((task: any) => {
    if (!task.taskId) {
      console.warn('Skipping task without taskId:', task);
      return;
    }

    const payload = {
      // tasks: this.selectedTaskForEdit.tasks.map((task: any) => ({
      //   taskId: task.taskId,
        description: task.description,
        status: task.status,
        hours: task.hours,
        extraHours: task.extraHours,
        prLink: task.prLink
      // }))
    };
    
    const promise =
    this.http.put<any>(
     `https://emp-rating-backend.onrender.com/api/v1/tasks/update/${task.taskId}`,
      payload,
      {
        headers: {
          Authorization: 'd44d4aeb-be2d-4dff-ba36-2526d7e19722'
        }
      }
    ).toPromise();

    updatePromises.push(promise);
  });

  if (updatePromises.length === 0) {
    this.showCustomAlert('No valid tasks to update!');
    return;
  }

  // Wait for ALL updates to complete, then refresh data
  Promise.all(updatePromises)
    .then(() => {
      this.showCustomAlert(`${updatePromises.length} task(s) updated successfully!`);
      this.closeEditPopup();
      // Force refresh with cache-busting parameter
      this.refreshUnratedTasks();
    })
    .catch((err) => {
      console.error('❌ Error updating tasks:', err);
      this.showCustomAlert('Error updating some tasks!');
      // Still refresh to show current state
      this.refreshUnratedTasks();
    });
}

// Add this new method to force refresh unrated tasks with cache busting
private refreshUnratedTasks(): void {
  if (!this.employeeId) return;
  
  const cacheBuster = new Date().getTime();
  this.http.get<any>(`https://emp-rating-backend.onrender.com/api/v1/tasks/withoutrating/${this.employeeId}?_t=${cacheBuster}`)
    .subscribe({
      next: (res) => {
        this.unratedTasks = res.tasks || [];
        this.currentMonthTasks = this.groupTasksByDate(this.unratedTasks);
        console.log('📅 Refreshed unrated tasks:', this.currentMonthTasks);
      },
      error: (err) => {
        console.error('Error refreshing unrated tasks:', err);
      }
    });
}

  editTask(index: number): void {
    const control = this.tasks.at(index);
    const taskId = control.value.taskId;
    if (!taskId) {
    this.showCustomAlert('Cannot edit a task without taskId!');
    return;
  }
    const payload = {
      description: control.value.description,
      status: control.value.status,
      hours: control.value.hours,
      extraHours: control.value.extraHours,
      prLink: control.value.prLink
    };

    this.http.put<any>(
      `https://emp-rating-backend.onrender.com/api/v1/tasks/update/${taskId}`,
      payload,
      {
        headers: {
          Authorization: 'd44d4aeb-be2d-4dff-ba36-2526d7e19722'
        }
      }
    ).subscribe({
      next: (res) => {
        this.showCustomAlert('Task updated successfully!');
        this.refreshUnratedTasks();
      },
      error: (err) => {
        console.error('❌ Error updating task:', err);
        this.showCustomAlert('Error updating task!');
      }
    });
  }


  saveTask(): void {
    if (this.taskForm.invalid) {
      this.showCustomAlert('Please fill all required fields!');
      return;
    }

    const formData = new FormData();
    formData.append('tasks', JSON.stringify(this.taskForm.value.tasks));

    this.tasks.controls.forEach((control) => {
      const file = control.get('file')?.value;
      if (file) {
        formData.append('files', file, file.name);
      }
    });

    this.http.post<any>(
      `https://emp-rating-backend.onrender.com/api/v1/tasks/submit/${this.employeeId}`,
      formData,
      {
        headers: {
          Authorization: 'd44d4aeb-be2d-4dff-ba36-2526d7e19722'
        }
      }
    ).subscribe({
      next: (res) => {
        this.showCustomAlert('Task saved successfully!');
        this.taskForm.reset();
        this.taskForm.setControl('tasks', this.fb.array([this.createTask(true)]));
        this.expandedTaskIndex = 0;
        this.refreshUnratedTasks();
      },
      error: (err) => {
        console.error('❌ Error saving task:', err);
        this.showCustomAlert('Error saving task!');
      }
    });
  }

  onExit(): void {
    this.showCustomConfirm('Are you sure you want to exit?', () => {
      if (this.isBrowser) {
        localStorage.clear();
        window.location.href = 'https://emp-rating-login.vercel.app/';
      }
    });
  }

  showCustomAlert(message: string): void {
    this.alertMessage = message;
    this.showAlert = true;
  }

  closeCustomAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
  }

  showCustomConfirm(message: string, callback: () => void): void {
    this.confirmMessage = message;
    this.confirmCallback = callback;
    this.showConfirm = true;
  }

  confirmYes(): void {
    if (this.confirmCallback) this.confirmCallback();
    this.showConfirm = false;
  }

  confirmNo(): void {
    this.showConfirm = false;
    this.confirmMessage = '';
    this.confirmCallback = null;
  }
}










