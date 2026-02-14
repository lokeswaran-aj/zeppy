import type { CallProgressItem } from "@/lib/domain";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<
  CallProgressItem["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "outline",
  dialing: "secondary",
  ringing: "secondary",
  connected: "default",
  analyzing: "secondary",
  completed: "default",
  failed: "destructive",
};

const STATUS_SCORE: Record<CallProgressItem["status"], number> = {
  queued: 5,
  dialing: 20,
  ringing: 35,
  connected: 70,
  analyzing: 90,
  completed: 100,
  failed: 100,
};

type ProgressTimelineProps = {
  calls: CallProgressItem[];
};

export function ProgressTimeline({ calls }: ProgressTimelineProps) {
  const completed = calls.filter((call) => call.status === "completed" || call.status === "failed").length;
  const overall = calls.length > 0 ? Math.round((completed / calls.length) * 100) : 0;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">
            {completed}/{calls.length} finished
          </span>
        </div>
        <Progress value={overall} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Call Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell>
                <div className="font-medium">{call.contactName}</div>
                <div className="text-xs text-muted-foreground">{call.phone}</div>
              </TableCell>
              <TableCell className="capitalize">{call.language}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[call.status]}>{call.status}</Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Progress value={STATUS_SCORE[call.status]} />
                  {call.failureReason ? (
                    <p className="text-xs text-destructive">{call.failureReason}</p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
