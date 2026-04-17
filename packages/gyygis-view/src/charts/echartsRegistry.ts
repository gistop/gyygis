/**
 * ECharts 按需注册：新增图表类型时在此补充 Chart / Component，再在 builders 中实现 option。
 */
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from "echarts/components";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
]);

export { echarts };
