import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2 } from "lucide-react";

export default function WorkflowNew() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Get signed URL
            const urlRes = await fetch("/api/uploads/request-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    contentType: file.type,
                }),
            });
            const { uploadUrl, objectPath } = await urlRes.json();

            // 2. Upload file
            await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });

            // 3. Create workflow instance
            // We pass the objectPath so the server can create the document record if needed
            const workflowRes = await fetch("/api/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "invoice_approval",
                    documentId: null,
                    objectPath, // Simplified for MVP
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                }),
            });

            const instance = await workflowRes.json();

            toast({ title: "Workflow Started", description: "Your invoice is being processed." });
            setLocation(`/workflows/${instance.id}`);
        } catch (error) {
            toast({ title: "Upload Failed", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 max-w-2xl">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        New Invoice Workflow
                    </CardTitle>
                    <p className="text-muted-foreground">Start an AI-powered approval workflow for your invoice.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl p-16 hover:border-primary/40 transition-all bg-accent/5 hover:bg-accent/10 group">
                        <div className="mb-6 p-6 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                            <FileUp className="w-16 h-16" />
                        </div>
                        <p className="text-xl font-semibold mb-2">Upload Invoice</p>
                        <p className="text-sm text-muted-foreground mb-8 text-center max-w-xs">
                            Securely upload your document. Our AI agents will extract data and route for approval.
                        </p>

                        <label className="relative">
                            <Button disabled={uploading} className="relative z-10 size-lg px-8 py-6 text-lg font-bold shadow-lg shadow-primary/20">
                                {uploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                {uploading ? "Uploading..." : "Select File"}
                            </Button>
                            <Input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer h-full"
                                onChange={handleFileUpload}
                                accept=".pdf,image/*"
                                disabled={uploading}
                            />
                        </label>
                        <p className="mt-4 text-xs text-muted-foreground">Supported: PDF, JPG, PNG (Max 10MB)</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
