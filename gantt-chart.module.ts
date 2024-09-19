import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { GanttChartComponent } from "./gantt-chart.component";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { TaskInfoModalComponent } from "../task-info-modal/task-info-modal.component";






@NgModule({
    imports : [        CommonModule,  
        RouterModule.forChild([
            {
                path : '',
                component : GanttChartComponent
            }
        ]),
      
        FormsModule,
        
         ],
    declarations : [GanttChartComponent ,  TaskInfoModalComponent ],
    exports : [GanttChartComponent, RouterModule],
    

})
export class GanttModule {

}