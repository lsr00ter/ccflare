import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface AccountAddFormProps {
	onAddAccount: (params: {
		name: string;
		mode: "max" | "console";
		tier: number;
		baseUrl?: string;
	}) => Promise<
		| { authUrl: string; sessionId: string }
		| { requiresApiKey: boolean; baseUrl: string }
		| null
	>;
	onCompleteAccount: (params: {
		sessionId: string;
		code: string;
	}) => Promise<void>;
	onAddDirectAccount: (params: {
		name: string;
		apiKey: string;
		tier: number;
		baseUrl: string;
	}) => Promise<void>;
	onCancel: () => void;
	onSuccess: () => void;
	onError: (error: string) => void;
}

export function AccountAddForm({
	onAddAccount,
	onCompleteAccount,
	onAddDirectAccount,
	onCancel,
	onSuccess,
	onError,
}: AccountAddFormProps) {
	const [authStep, setAuthStep] = useState<"form" | "code" | "apikey">("form");
	const [authCode, setAuthCode] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [sessionId, setSessionId] = useState("");
	const [newAccount, setNewAccount] = useState({
		name: "",
		mode: "max" as "max" | "console",
		tier: 1,
		baseUrl: "",
	});

	const handleAddAccount = async () => {
		if (!newAccount.name) {
			onError("Account name is required");
			return;
		}

		// If base URL is provided, use direct API key flow
		if (newAccount.baseUrl) {
			setAuthStep("apikey");
			return;
		}

		// Step 1: Initialize OAuth flow
		const result = await onAddAccount(newAccount);
		if (!result) {
			onError("Failed to initialize OAuth flow");
			return;
		}

		// Check if the result indicates we need direct API key (baseUrl was provided)
		if ("requiresApiKey" in result && result.requiresApiKey) {
			setAuthStep("apikey");
			return;
		}

		const { authUrl, sessionId } = result as {
			authUrl: string;
			sessionId: string;
		};
		setSessionId(sessionId);

		// Open auth URL in new tab
		if (typeof window !== "undefined") {
			window.open(authUrl, "_blank");
		}

		// Move to code entry step
		setAuthStep("code");
	};

	const handleCodeSubmit = async () => {
		if (!authCode) {
			onError("Authorization code is required");
			return;
		}
		// Step 2: Complete OAuth flow
		await onCompleteAccount({
			sessionId,
			code: authCode,
		});

		// Success! Reset form
		setAuthStep("form");
		setAuthCode("");
		setSessionId("");
		setNewAccount({ name: "", mode: "max", tier: 1, baseUrl: "" });
		onSuccess();
	};

	const handleApiKeySubmit = async () => {
		if (!apiKey) {
			onError("API key is required");
			return;
		}

		await onAddDirectAccount({
			name: newAccount.name,
			apiKey: apiKey,
			tier: newAccount.tier,
			baseUrl: newAccount.baseUrl,
		});

		// Success! Reset form
		setAuthStep("form");
		setApiKey("");
		setNewAccount({ name: "", mode: "max", tier: 1, baseUrl: "" });
		onSuccess();
	};

	const handleCancel = () => {
		setAuthStep("form");
		setAuthCode("");
		setApiKey("");
		setSessionId("");
		setNewAccount({ name: "", mode: "max", tier: 1, baseUrl: "" });
		onCancel();
	};

	return (
		<div className="space-y-4 mb-6 p-4 border rounded-lg">
			<h4 className="font-medium">
				{authStep === "form"
					? "Add New Account"
					: authStep === "code"
						? "Enter Authorization Code"
						: "Enter API Key"}
			</h4>
			{authStep === "form" && (
				<>
					<div className="space-y-2">
						<Label htmlFor="name">Account Name</Label>
						<Input
							id="name"
							value={newAccount.name}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setNewAccount({
									...newAccount,
									name: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="e.g., work-account or user@example.com"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="mode">Mode</Label>
						<Select
							value={newAccount.mode}
							onValueChange={(value: "max" | "console") =>
								setNewAccount({ ...newAccount, mode: value })
							}
						>
							<SelectTrigger id="mode">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="max">Max (Recommended)</SelectItem>
								<SelectItem value="console">Console</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="baseUrl">Base URL (Optional)</Label>
						<Input
							id="baseUrl"
							value={newAccount.baseUrl}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setNewAccount({
									...newAccount,
									baseUrl: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="https://api.example.com (leave empty for Anthropic API)"
						/>
						<p className="text-xs text-muted-foreground">
							If provided, OAuth will be skipped and you'll be asked for an API
							key directly
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="tier">Tier</Label>
						<Select
							value={String(newAccount.tier)}
							onValueChange={(value: string) =>
								setNewAccount({ ...newAccount, tier: parseInt(value) })
							}
						>
							<SelectTrigger id="tier">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">Tier 1 (Default)</SelectItem>
								<SelectItem value="5">Tier 5</SelectItem>
								<SelectItem value="20">Tier 20</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</>
			)}
			{authStep === "form" ? (
				<div className="flex gap-2">
					<Button onClick={handleAddAccount}>
						{newAccount.baseUrl
							? "Continue with API Key"
							: "Continue with OAuth"}
					</Button>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
				</div>
			) : authStep === "apikey" ? (
				<>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Since you provided a custom base URL ({newAccount.baseUrl}), OAuth
							will be skipped. Please enter your API key directly.
						</p>
						<Label htmlFor="apikey">API Key</Label>
						<Input
							id="apikey"
							type="password"
							value={apiKey}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setApiKey((e.target as HTMLInputElement).value)
							}
							placeholder="sk-ant-..."
						/>
					</div>
					<div className="flex gap-2">
						<Button onClick={handleApiKeySubmit}>Add Account</Button>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
					</div>
				</>
			) : (
				<>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							A new browser tab has opened for authentication. After
							authorizing, copy the code and paste it below.
						</p>
						<Label htmlFor="code">Authorization Code</Label>
						<Input
							id="code"
							value={authCode}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setAuthCode((e.target as HTMLInputElement).value)
							}
							placeholder="Paste authorization code here"
						/>
					</div>
					<div className="flex gap-2">
						<Button onClick={handleCodeSubmit}>Complete Setup</Button>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
