import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Info,
    ChevronRight,
    FileText,
    Activity,
    User,
    Bot
} from "lucide-react";

export default function WorkflowView() {
    const { id } = useParams();
    const { toast } = useToast();
    const [fields, setFields] = useState<any[]>([]);

    const { data: instance, isLoading: loadingInstance } = useQuery<any>({
        queryKey: [`/api/workflows/${id}`],
    });

    const { data: timeline, isLoading: loadingTimeline } = useQuery<any[]>({
        queryKey: [`/api/workflows/${id}/timeline`],
        refetchInterval: instance?.status === "active" ? 3000 : false,
    });

    useEffect(() => {
        if (instance?.data?.extractedFields) {
            setFields(instance.data.extractedFields);
        }
    }, [instance]);

    const actionMutation = useMutation({
        mutationFn: async ({ action, data }: { action: string, data?: any }) => {
            const res = await fetch(`/api/workflows/${id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, data }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/workflows/${id}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/workflows/${id}/timeline`] });
            toast({ title: "Action submitted" });
        }
    });

    if (loadingInstance) return <div className="p-10"><Skeleton className="h-20 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;

    const currentStep = instance?.currentStep;
    const isPendingUser = instance?.status === "active" && !["extraction", "compliance", "routing", "dispatch", "archive"].includes(currentStep);

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Invoice Workflow</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        ID: <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{id}</span>
                        <Badge variant={instance?.status === "closed_approved" ? "default" : "secondary"}>
                            {instance?.status.toUpperCase()}
                        </Badge>
                    </p>
                </div>
                <div className="flex gap-2">
                    {isPendingUser && (
                        <>
                            <Button variant="outline" onClick={() => actionMutation.mutate({ action: "request_info" })}>Request Info</Button>
                            <Button variant="destructive" onClick={() => actionMutation.mutate({ action: "reject" })}>Reject</Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => actionMutation.mutate({ action: "approve", data: { extractedFields: fields } })}>Approve</Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Extracted Data */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-primary/10 shadow-lg">
                        <CardHeader className="border-b bg-muted/30">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Extracted Fields
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-1/3">Field</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead className="w-24">Confidence</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">{field.label}</TableCell>
                                            <TableCell>
                                                <Input
                                                    value={field.value ?? ""}
                                                    onChange={(e) => {
                                                        const newFields = [...fields];
                                                        newFields[idx].value = e.target.value;
                                                        setFields(newFields);
                                                    }}
                                                    className={field.confidence < 0.7 ? "border-amber-400 bg-amber-50/50" : ""}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={field.confidence < 0.7 ? "outline" : "secondary"} className={field.confidence < 0.7 ? "text-amber-600 border-amber-200" : ""}>
                                                    {Math.round(field.confidence * 100)}%
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {instance?.data?.summaryFinance && (
                        <Card className="border-blue-100 bg-blue-50/30">
                            <CardHeader>
                                <CardTitle className="text-blue-800 flex items-center gap-2">
                                    <Bot className="w-5 h-5" />
                                    AI Summary for Finance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-blue-900 leading-relaxed">{instance.data.summaryFinance}</p>
                                {instance.data.flags?.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {instance.data.flags.map((flag: string, i: number) => (
                                            <Badge key={i} variant="outline" className="bg-white text-amber-700 border-amber-200 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                {flag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar: Status & Timeline */}
                <div className="space-y-8">
                    <Card>
                        <CardHeader className="bg-muted/30">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current Step</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10 text-primary">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xl font-bold capitalize">{currentStep.replace("_", " ")}</p>
                                    <p className="text-sm text-muted-foreground">{instance?.status === "active" ? "In Progress" : "Completed"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-muted/30">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-6">
                                {timeline?.map((log, i) => (
                                    <div key={log.id} className="relative pl-6 pb-6 last:pb-0">
                                        {i !== timeline.length - 1 && (
                                            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-muted" />
                                        )}
                                        <div className="absolute left-0 top-1">
                                            {log.userId === "system" ? <Bot className="w-6 h-6 text-primary bg-background p-1" /> : <User className="w-6 h-6 text-muted-foreground bg-background p-1" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{log.action.replace("_", " ").toUpperCase()}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
