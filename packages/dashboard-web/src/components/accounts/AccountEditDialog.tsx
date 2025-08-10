import { useState } from "react";
import type { Account } from "../../api";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

interface AccountEditDialogProps {
	isOpen: boolean;
	account: Account | null;
	onClose: () => void;
	onSave: (accountId: string, updates: AccountUpdates) => Promise<void>;
	isLoading?: boolean;
}

export interface AccountUpdates {
	name?: string;
	tier?: number;
	paused?: boolean;
	rateLimitOverride?: {
		enabled: boolean;
		customLimit?: number;
		resetWindowMinutes?: number;
	};
}

export function AccountEditDialog({
	isOpen,
	account,
	onClose,
	onSave,
	isLoading = false,
}: AccountEditDialogProps) {
	const [formData, setFormData] = useState({
		name: account?.name || "",
		tier: account?.tier || 1,
		paused: account?.paused || false,
		rateLimitOverrideEnabled: false,
		customLimit: 1000,
		resetWindowMinutes: 60,
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Reset form when account changes
	useState(() => {
		if (account) {
			setFormData({
				name: account.name,
				tier: account.tier,
				paused: account.paused,
				rateLimitOverrideEnabled: false,
				customLimit: 1000,
				resetWindowMinutes: 60,
			});
			setErrors({});
		}
	});

	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {};

		// Validate name
		const trimmedName = formData.name.trim();
		if (!trimmedName) {
			newErrors.name = "Account name cannot be empty";
		} else if (trimmedName.length > 100) {
			newErrors.name = "Account name must be 100 characters or less";
		}

		// Validate custom rate limit
		if (formData.rateLimitOverrideEnabled) {
			if (formData.customLimit < 1 || formData.customLimit > 100000) {
				newErrors.customLimit = "Custom limit must be between 1 and 100,000";
			}
			if (
				formData.resetWindowMinutes < 1 ||
				formData.resetWindowMinutes > 1440
			) {
				newErrors.resetWindowMinutes =
					"Reset window must be between 1 and 1,440 minutes";
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!account || !validateForm()) {
			return;
		}

		const updates: AccountUpdates = {};

		// Check what changed
		if (formData.name.trim() !== account.name) {
			updates.name = formData.name.trim();
		}
		if (formData.tier !== account.tier) {
			updates.tier = formData.tier;
		}
		if (formData.paused !== account.paused) {
			updates.paused = formData.paused;
		}
		if (formData.rateLimitOverrideEnabled) {
			updates.rateLimitOverride = {
				enabled: true,
				customLimit: formData.customLimit,
				resetWindowMinutes: formData.resetWindowMinutes,
			};
		}

		// Only save if there are changes
		if (Object.keys(updates).length > 0) {
			await onSave(account.id, updates);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	if (!account) return null;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Edit Account</DialogTitle>
						<DialogDescription>
							Modify account settings and rate limiting controls.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						{/* Account Name */}
						<div className="grid gap-2">
							<Label htmlFor="edit-name">Account Name</Label>
							<Input
								id="edit-name"
								value={formData.name}
								onChange={(e) => {
									setFormData({ ...formData, name: e.target.value });
									setErrors({ ...errors, name: "" });
								}}
								placeholder="Enter account name"
								disabled={isLoading}
							/>
							{errors.name && (
								<p className="text-sm text-destructive">{errors.name}</p>
							)}
						</div>

						{/* Account Tier */}
						<div className="grid gap-2">
							<Label htmlFor="edit-tier">Account Tier</Label>
							<Select
								value={String(formData.tier)}
								onValueChange={(value) =>
									setFormData({ ...formData, tier: parseInt(value) })
								}
								disabled={isLoading}
							>
								<SelectTrigger id="edit-tier">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">Tier 1 (1x weight)</SelectItem>
									<SelectItem value="5">Tier 5 (5x weight)</SelectItem>
									<SelectItem value="20">Tier 20 (20x weight)</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Higher tiers receive more requests in load balancing
							</p>
						</div>

						{/* Pause Toggle */}
						<div className="flex items-center justify-between">
							<div className="grid gap-1">
								<Label htmlFor="edit-paused">Pause Account</Label>
								<p className="text-xs text-muted-foreground">
									Temporarily disable this account from receiving requests
								</p>
							</div>
							<Switch
								id="edit-paused"
								checked={formData.paused}
								onCheckedChange={(checked) =>
									setFormData({ ...formData, paused: checked })
								}
								disabled={isLoading}
							/>
						</div>

						{/* Rate Limit Override Section */}
						<div className="space-y-3 border-t pt-4">
							<div className="flex items-center justify-between">
								<div className="grid gap-1">
									<Label htmlFor="rate-limit-override">
										Custom Rate Limiting
									</Label>
									<p className="text-xs text-muted-foreground">
										Override automatic rate limit detection
									</p>
								</div>
								<Switch
									id="rate-limit-override"
									checked={formData.rateLimitOverrideEnabled}
									onCheckedChange={(checked) =>
										setFormData({
											...formData,
											rateLimitOverrideEnabled: checked,
										})
									}
									disabled={isLoading}
								/>
							</div>

							{formData.rateLimitOverrideEnabled && (
								<div className="space-y-3 pl-4 border-l-2 border-muted">
									{/* Custom Limit */}
									<div className="grid gap-2">
										<Label htmlFor="custom-limit">Requests per Window</Label>
										<Input
											id="custom-limit"
											type="number"
											min="1"
											max="100000"
											value={formData.customLimit}
											onChange={(e) => {
												setFormData({
													...formData,
													customLimit: parseInt(e.target.value) || 1000,
												});
												setErrors({ ...errors, customLimit: "" });
											}}
											disabled={isLoading}
										/>
										{errors.customLimit && (
											<p className="text-sm text-destructive">
												{errors.customLimit}
											</p>
										)}
									</div>

									{/* Reset Window */}
									<div className="grid gap-2">
										<Label htmlFor="reset-window">Reset Window (minutes)</Label>
										<Input
											id="reset-window"
											type="number"
											min="1"
											max="1440"
											value={formData.resetWindowMinutes}
											onChange={(e) => {
												setFormData({
													...formData,
													resetWindowMinutes: parseInt(e.target.value) || 60,
												});
												setErrors({ ...errors, resetWindowMinutes: "" });
											}}
											disabled={isLoading}
										/>
										{errors.resetWindowMinutes && (
											<p className="text-sm text-destructive">
												{errors.resetWindowMinutes}
											</p>
										)}
									</div>

									<p className="text-xs text-muted-foreground">
										⚠️ Custom rate limits override provider-detected limits and
										may cause request failures if set too high.
									</p>
								</div>
							)}
						</div>

						{/* Current Rate Limit Status */}
						<div className="bg-muted/50 p-3 rounded-lg text-sm">
							<div className="font-medium mb-1">Current Status:</div>
							<div className="space-y-1 text-muted-foreground">
								<div>Rate Limit: {account.rateLimitStatus}</div>
								{account.rateLimitReset && (
									<div>
										Resets: {new Date(account.rateLimitReset).toLocaleString()}
									</div>
								)}
								{account.rateLimitRemaining !== null && (
									<div>Remaining: {account.rateLimitRemaining} requests</div>
								)}
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
