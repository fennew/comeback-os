"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useClientContext } from "@/providers/client-context-provider";
import {
  ArrowLeft, Save, Loader2, Trash2, Upload, FileText,
  Image as ImageIcon, File, X
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  brand_colors: string | null;
  brand_voice: string | null;
  industry: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  monthly_retainer: number | null;
  contract_start: string | null;
  contract_end: string | null;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  url: string;
  category: string;
  created_at: string;
}

const ASSET_CATEGORIES = [
  { value: "logo", label: "Logos" },
  { value: "brand-guide", label: "Brand Guidelines" },
  { value: "fonts", label: "Fonts" },
  { value: "photos", label: "Photos" },
  { value: "templates", label: "Templates" },
  { value: "docs", label: "Documents" },
  { value: "other", label: "Other" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return File;
}

export default function ClientSettingsPage() {
  const { clientId } = useParams();
  const router = useRouter();
  const { refreshClients } = useClientContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    industry: "",
    website: "",
    brand_voice: "",
    brand_colors: "",
    notes: "",
    monthly_retainer: "",
    status: "active",
    contract_start: "",
    contract_end: "",
    logo_url: "",
  });

  // Assets state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients?id=${clientId}`).then((r) => r.json()),
      fetch(`/api/clients/assets?clientId=${clientId}`).then((r) => r.json()),
    ]).then(([clientData, assetsData]) => {
      setClient(clientData);
      setForm({
        name: clientData.name || "",
        industry: clientData.industry || "",
        website: clientData.website || "",
        brand_voice: clientData.brand_voice || "",
        brand_colors: clientData.brand_colors || "",
        notes: clientData.notes || "",
        monthly_retainer: clientData.monthly_retainer?.toString() || "",
        status: clientData.status || "active",
        contract_start: clientData.contract_start || "",
        contract_end: clientData.contract_end || "",
        logo_url: clientData.logo_url || "",
      });
      setAssets(Array.isArray(assetsData) ? assetsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clientId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          name: form.name,
          industry: form.industry || null,
          website: form.website || null,
          brand_voice: form.brand_voice || null,
          brand_colors: form.brand_colors || null,
          notes: form.notes || null,
          monthly_retainer: form.monthly_retainer ? parseFloat(form.monthly_retainer) : null,
          status: form.status,
          contract_start: form.contract_start || null,
          contract_end: form.contract_end || null,
          logo_url: form.logo_url || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      await refreshClients();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId as string);
        formData.append("category", uploadCategory);

        const res = await fetch("/api/clients/assets", { method: "POST", body: formData });
        if (res.ok) {
          const asset = await res.json();
          setAssets((prev) => [asset, ...prev]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAsset(assetId: string) {
    const res = await fetch(`/api/clients/assets?id=${assetId}`, { method: "DELETE" });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    }
  }

  async function handleDeleteClient() {
    if (!confirm("Are you sure you want to delete this client? This cannot be undone.")) return;
    const res = await fetch(`/api/clients?id=${clientId}`, { method: "DELETE" });
    if (res.ok) {
      await refreshClients();
      router.push("/clients");
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (!client) return <div className="text-muted-foreground">Client not found</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/clients/${clientId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Edit Client</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-500">Saved!</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client / Brand Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
                <option value="onboarding">Onboarding</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. E-commerce, SaaS" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://example.com/logo.png" />
          </div>
        </CardContent>
      </Card>

      {/* Contract & Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Contract & Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Monthly Retainer ($)</Label>
              <Input type="number" step="0.01" value={form.monthly_retainer} onChange={(e) => setForm({ ...form, monthly_retainer: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Contract Start</Label>
              <Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contract End</Label>
              <Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Data */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Data</CardTitle>
          <CardDescription>This information is automatically provided to all agents when this client is selected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Brand Voice</Label>
            <Textarea
              value={form.brand_voice}
              onChange={(e) => setForm({ ...form, brand_voice: e.target.value })}
              placeholder="Describe the brand's tone and voice. e.g. Professional but friendly, uses humor..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand Colors</Label>
            <Input
              value={form.brand_colors}
              onChange={(e) => setForm({ ...form, brand_colors: e.target.value })}
              placeholder="e.g. #FF5733, #2C3E50, #ECF0F1"
            />
            <p className="text-xs text-muted-foreground">Comma-separated hex codes</p>
            {form.brand_colors && (
              <div className="flex gap-2 mt-1">
                {form.brand_colors.split(",").map((c, i) => (
                  <div key={i} className="h-6 w-6 rounded border" style={{ backgroundColor: c.trim() }} title={c.trim()} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional info, special instructions, key contacts..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Brand Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Assets</CardTitle>
          <CardDescription>Upload logos, brand guidelines, photos, docs — agents will use these when working on this client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload controls */}
          <div className="flex items-center gap-2">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg,.ai,.eps,.psd,.zip,.mp4"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Files"}
            </Button>
          </div>

          {/* Assets list grouped by category */}
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No brand assets uploaded yet</p>
          ) : (
            <div className="space-y-4">
              {ASSET_CATEGORIES.filter((cat) => assets.some((a) => a.category === cat.value)).map((cat) => (
                <div key={cat.value}>
                  <h4 className="text-sm font-medium mb-2">{cat.label}</h4>
                  <div className="space-y-1">
                    {assets.filter((a) => a.category === cat.value).map((asset) => {
                      const Icon = getFileIcon(asset.file_type);
                      return (
                        <div key={asset.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {asset.file_type.startsWith("image/") ? (
                              <img src={asset.url} alt={asset.name} className="h-8 w-8 rounded object-cover" />
                            ) : (
                              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                            <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline">
                              {asset.name}
                            </a>
                            <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(asset.file_size)}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteAsset(asset.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Client</p>
              <p className="text-xs text-muted-foreground">Permanently delete this client and all associated data</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDeleteClient}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Client
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
