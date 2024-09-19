import { AfterViewInit, Component , OnDestroy, OnInit, ViewChild} from '@angular/core';
import 'dhtmlx-gantt';
import { gantt, Task } from 'dhtmlx-gantt';
import { ProjectsService } from '../core/service/projects.service';
import { TasksService } from '../core/service/tasks.service';
import { Project2 } from '../productowner/projects/core/project.model';
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs';

export interface Taskgantt {
  _id: string;
  Title: string;
  Project: string;
  Details: string;
  Status: string;
  StartDate: Date;
  Deadline: Date;
  Executor: string[];
  progress: number;
  Priority: string;
  closedAt?: Date;
}

@Component({
  selector: 'app-gantt-chart',
  templateUrl: './gantt-chart.component.html',
  styleUrls: ['./gantt-chart.component.scss']
})
export class GanttChartComponent implements OnInit, OnDestroy, AfterViewInit {
  searchInput: string = '';
  allProjects: any[] = [];
  allTasks: any[] = [];
  originalTasks: any[] = [];
  selectedTask: any;
  selectedProjet: any;
  tasks : any = [];
  showModal: boolean = false;
  private projectId: string | null = null;
  taskCountcomp: number=0;
  taskCountover: number=0;
  selectedFilter: string = 'all'; 
  filterOptions = ['all', 'week', 'month', 'year', 'more-than-year'];
   ongoingProjectsCount = 0;
   completedProjectsCount = 0;
  totalproject: number;
  totaltasks: number;
  constructor(
    private projectsService: ProjectsService,
    private tasksService: TasksService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(
      tap(params => {
        this.projectId = params.get('id'); 
        console.log(this.projectId);
        this.loadProjectsAndTasks();
        this.setupGantt();

      })
    ).subscribe()

  }

  ngAfterViewInit(): void {
    this.setupGantt();
    
  }

  setupGantt(): void {
    console.log("gant init")
    gantt.config.scales = [
      { unit: "month", step: 1, format: "%F, %Y" },
      { unit: "day", step: 1, format: "%j, %D" }
    ];
    gantt.config.scale_height = 50;

    gantt.config.columns = [
      { name: "text", label: "Task/Project Name", width: "*", tree: true },
      { name: "duration", label: "Duration", align: "center" },
      { name: "priority", label: "Priority", align: "center" }
    ];

    gantt.templates.grid_row_class = (start, end, task) => {
      if (task.priority) {
        return `priority-${task.priority.toLowerCase()}`;
      }
      return '';
    };

    gantt.templates.task_class = (start, end, task) => {
      if (task.type === 'project') {
        return 'project-task';
      }
      return '';
    };

    gantt.config.lightbox = {};
    gantt.config.drag_progress = false;
    gantt.config.bar_height = 20;
    gantt.config.drag_links = false;
    gantt.config.drag_resize = false;
    gantt.config.drag_move = false;

    gantt.attachEvent("onTaskClick", (id, e) => {
      if ((e.target as HTMLElement).classList.contains("gantt_tree_icon")) {
        return true;
      }
      const task = gantt.getTask(id);
      if (task.type === 'project') {
        this.projectsService.getProject(task.id).subscribe(project => {
          this.selectedProjet = project;
          this.selectedTask = null;
          this.showModal = true;
        }, error => {
          console.error(`Error fetching project ${task.id}:`, error);
        });
      } else {
        this.tasksService.getTaskbyid(task.id).subscribe(task => {
          this.selectedTask = task;
          this.selectedProjet = null;
          this.showModal = true;
        }, error => {
          console.error(`Error fetching task ${task.id}:`, error);
        });
      }
      return false;
    });

    gantt.init('gantt_here');
  }

  loadProjectsAndTasks(): void {
    if (this.projectId) {
        this.loadSingleProject(this.projectId);
    } else {
        this.loadAllProjects();
    }

}

loadSingleProject(projectId: string): void {
    this.projectsService.getProject(projectId).subscribe(
        (project: Project2) => {
            const projectTask = this.createProjectTask(project);
            const tasks = [projectTask];
            this.allProjects.push(projectTask);
            this.allTasks.push(projectTask);

            this.tasksService.getTaskbyproject(projectId).subscribe(
                (taskList: Taskgantt[]) => {
                    this.addTasksToProject(taskList, projectTask.id, tasks);
                    gantt.parse({ data: tasks });
                    this.originalTasks = [...this.allTasks];
                    this.calculateProjectStatuses();  
                },
                (error) => {
                    console.error(`Error fetching tasks for Project ${projectId}:`, error);
                }
            );
        },
        (error) => {
            console.error(`Error fetching project ${projectId}:`, error);
        }
    );
}

loadAllProjects(): void {
    this.projectsService.getAllProjects().subscribe(
        (projects: Project2[]) => {
            let projectTaskCount = projects.length;

            projects.forEach((project) => {
                const projectTask = this.createProjectTask(project);
                this.tasks.push(projectTask);
                this.allProjects.push(projectTask);
                this.allTasks.push(projectTask);

                this.tasksService.getTaskbyproject(project._id).subscribe(
                    (taskList: Taskgantt[]) => {
                        this.addTasksToProject(taskList, projectTask.id, this.tasks);
                        projectTaskCount--;
                        if (projectTaskCount === 0) {
                            gantt.parse({ data: this.tasks });
                            this.originalTasks = [...this.allTasks];
                            this.calculateProjectStatuses(); 
                        }
                    },
                    (error) => {
                        console.error(`Error fetching tasks for Project ${project._id}:`, error);
                        projectTaskCount--;
                        if (projectTaskCount === 0) {
                            gantt.parse({ data: this.tasks });
                            this.originalTasks = [...this.allTasks];
                            this.calculateProjectStatuses();
                        }
                    }
                );
            });
        },
        (error) => {
            console.error('Error fetching projects:', error);
        }
    );
}

createProjectTask(project: Project2): any {
    const startDate = this.formatDate(project.dateDebut);
    const endDate = this.formatDate(project.dateFin);
    return {
        id: project._id,
        text: project.Projectname,
        start_date: startDate,
        duration: this.calculateDuration(startDate, endDate),
        progress: project.progress / 100,
        priority: project.priority,
        open: true,
        type: 'project',
        color: 'grey',
    };
}

addTasksToProject(taskList: Taskgantt[], parentId: string, tasks: any[]): void {
  taskList.forEach((task) => {
      let taskStartDate = this.formatDate(task.StartDate);
      let taskEndDate = this.formatDate(task.Deadline);

      if (taskStartDate === taskEndDate) {
          const [day, month, year] = taskEndDate.split('-').map(Number);
          const endDateObject = new Date(year, month - 1, day);
                    endDateObject.setDate(endDateObject.getDate() + 1);
                    const newDay = String(endDateObject.getDate()).padStart(2, '0');
          const newMonth = String(endDateObject.getMonth() + 1).padStart(2, '0');
          const newYear = endDateObject.getFullYear();
          taskEndDate = `${newDay}-${newMonth}-${newYear}`;
      }

      const { color, borderColor } = this.getTaskStyles(task);
      this.countupdate(task);

      const ganttTask = {
          id: task._id,
          text: task.Title,
          start_date: taskStartDate,
          end_date: taskEndDate,
          duration: this.calculateDuration(taskStartDate, taskEndDate),
          progress: task.progress / 100,
          priority: task.Priority,
          parent: parentId,
          type: 'task',
          color: color,
          borderColor: borderColor,
          closedAt: task.closedAt ? this.formatDate(task.closedAt) : null,
      };

      tasks.push(ganttTask);
      this.allTasks.push(ganttTask);
  });
}

onSearchChange(e: any): void {
  this.searchInput = e.target.value.toLowerCase();
  this.handleProjectSearch();
}

handleProjectSearch(): void {
  if (this.searchInput === '') {
    gantt.clearAll();
    gantt.parse({ data: this.originalTasks });
    gantt.render();
    return;
  }

  const filteredProjects = this.allProjects.filter(project => 
    project.text.toLowerCase().includes(this.searchInput)
  );

  const filteredTasks = [];
  filteredProjects.forEach(project => {
    filteredTasks.push(project);
    this.allTasks.forEach(task => {
      if (task.parent === project.id || task.text.toLowerCase().includes(this.searchInput)) {
        filteredTasks.push(task);
      }
    });
  });

  gantt.clearAll();
  gantt.parse({ data: filteredTasks });
  gantt.render();
}


  displayTaskInfo(task: any): void {
    this.selectedTask = task;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  ngOnDestroy(): void {
    gantt.clearAll();
  }

  private formatDate(date: Date): string | null {
    if (!date) return null;

    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  }

  private calculateDuration(startDate: string | null, endDate: string | null): number {
    if (!startDate || !endDate) return 0;
console.log(startDate , endDate);

    const start = new Date(startDate.split('-').reverse().join('-'));
    const end = new Date(endDate.split('-').reverse().join('-'));
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const t=  Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return t == 0? 1 : t;
  }

  private getTaskStyles(task: Taskgantt): { color: string; borderColor: string } {
    const currentDate = new Date();
    const endDate = new Date(task.Deadline);
    const closedAt = task.closedAt ? new Date(task.closedAt) : null;

    let color = '';
    let borderColor = ''; 

    if (task.progress === 100) {
        if (closedAt && closedAt <= endDate) {
            // Task is completed and was closed on or before the deadline
            color = '#28a745'; // Green
        } else if (closedAt && closedAt > endDate) {
            // Task is completed but was closed after the deadline
            color = '#ff8c00'; // Orange
        }
    } else if (currentDate > endDate) {
        // Task is not completed and the deadline has passed
        color = '#dc3510'; // Red
    }

    borderColor = color ? color : 'transparent'; 

    return { color, borderColor };
}
  private isoverdue(task: Taskgantt): boolean {
    const currentDate = new Date();
    const endDate = new Date(task.Deadline);
    const timeDifference = endDate.getTime() - currentDate.getTime();
    return timeDifference < 0 && task.progress < 100;
  }
  private iscompleted(task: Taskgantt): boolean {
    return task.progress == 100;
  }
  private countupdate(task: Taskgantt){
    if (this.iscompleted(task)){
      this.taskCountcomp++;}else if (this.isoverdue(task)){
        this.taskCountover++;}
}
getTotalProjects(): number {
  return this.totalproject= this.allProjects.length;
}
getTotalTasks(): number {
  this.totaltasks = this.allTasks.filter(task => task.type === 'task').length;
  return this.totaltasks;
}
calculateProjectStatuses(): void {
  this.completedProjectsCount = 0;
  this.ongoingProjectsCount = 0;

  const currentDate = new Date();

  this.allProjects.forEach(project => {
    const projectTasks = this.allTasks.filter(task => task.parent === project.id);

    if (projectTasks.length > 0) {
      let allTasksCompleted = true; 
      let hasOngoingTasks = false;  

      projectTasks.forEach(task => {
        const isTaskCompleted = task.progress === 1; 
        const isTaskOngoing = task.progress < 1 && task.end_date > currentDate; 

        console.log(`Task ID: ${task._id}, Progress: ${task.progress}, Deadline: ${task.deadline}, Completed: ${isTaskCompleted}, Ongoing: ${isTaskOngoing}`);

        if (!isTaskCompleted) {
          allTasksCompleted = false;
        }

        if (isTaskOngoing) {
          hasOngoingTasks = true;
        }
      });

      if (allTasksCompleted) {
        this.completedProjectsCount++;
        console.log(`Project ${project.text} is completed.`);
      } 
      
      if (hasOngoingTasks) {
        this.ongoingProjectsCount++;
        console.log(`Project ${project.text} has ongoing tasks.`);
      }
    } else {
      console.log(`Project ${project.text} has no tasks.`);
    }
  });

  console.log(`Total Projects: ${this.getTotalProjects()}`);
  console.log(`Total Tasks: ${this.getTotalTasks()}`);
  console.log(`Ongoing Projects: ${this.ongoingProjectsCount}`);
  console.log(`Completed Projects: ${this.completedProjectsCount}`);
}

onFilterChange(event: Event): void {
  const selectElement = event.target as HTMLSelectElement;
  this.selectedFilter = selectElement.value;
  this.applyFilter();
}

applyFilter(): void {
  console.log('All Projects:', this.allProjects);
  console.log('Original Tasks:', this.originalTasks);

  const currentDate = this.stripTime(new Date()); 

  let filteredProjects = this.allProjects.map(project => {
    const startDate = new Date(project.start_date);
    if (isNaN(startDate.getTime())) {
      console.error(`Invalid Start Date for project ${project.id}:`, project.start_date);
      return null;
    }
    return { ...project, start_date: this.stripTime(startDate) };
  }).filter(project => project !== null);

  console.log('Converted and Filtered Projects:', filteredProjects);

  switch (this.selectedFilter) {
    case 'week':
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      filteredProjects = filteredProjects.filter(project =>
        project.start_date >= this.stripTime(startOfWeek) && project.start_date <= currentDate
      );
      break;

    case 'month':
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      filteredProjects = filteredProjects.filter(project =>
        project.start_date >= this.stripTime(startOfMonth) && project.start_date <= currentDate
      );
      break;

    case 'year':
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      filteredProjects = filteredProjects.filter(project =>
        project.start_date >= this.stripTime(startOfYear) && project.start_date <= currentDate
      );
      break;

    case 'more-than-year':
      const startOfPastYear = new Date(currentDate.getFullYear() - 1, 0, 1);
      filteredProjects = filteredProjects.filter(project =>
        project.start_date < this.stripTime(startOfPastYear)
      );
      break;

    case 'all':
    default:
      filteredProjects = this.allProjects;
      break;
  }

  console.log('Filtered Projects:', filteredProjects);

  const filteredProjectIds = filteredProjects.map(project => project.id);
  console.log('Filtered Project IDs:', filteredProjectIds);

  const filteredTasks = this.originalTasks.filter(task =>
    filteredProjectIds.includes(task.parent)
  );

  console.log('Filtered Tasks:', filteredTasks);

  this.updateGanttChart(filteredProjects, filteredTasks);
}

private stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
private updateGanttChart(filteredProjects: any[], filteredTasks: any[]): void {
  try {
    gantt.clearAll();
    gantt.parse({ data: [...filteredProjects, ...filteredTasks] });
    gantt.render();
    this.calculateProjectStatuses(); 

  } catch (error) {
    console.error('Error updating Gantt chart:', error);
  }
}}