import { AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { type Account, api } from "../api";
import { useAccounts, useRenameAccount } from "../hooks/queries";
import { useApiError } from "../hooks/useApiError";
import {
	AccountAddForm,
	AccountEditDialog,
	AccountList,
	type AccountUpdates,
	DeleteConfirmationDialog,
	RenameAccountDialog,
} from "./accounts";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

export function AccountsTab() {
	const { formatError } = useApiError();
	const {
		data: accounts,
		isLoading: loading,
		error,
		refetch: loadAccounts,
	} = useAccounts();
	const renameAccount = useRenameAccount();

	const [adding, setAdding] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<{
		show: boolean;
		accountName: string;
		confirmInput: string;
	}>({
		show: false,
		accountName: "",
		confirmInput: "",
	});
	const [renameDialog, setRenameDialog] = useState<{
		isOpen: boolean;
		account: Account | null;
	}>({
		isOpen: false,
		account: null,
	});
	const [editDialog, setEditDialog] = useState<{
		isOpen: boolean;
		account: Account | null;
		isLoading: boolean;
	}>({
		isOpen: false,
		account: null,
		isLoading: false,
	});
	const [actionError, setActionError] = useState<string | null>(null);

	const handleAddAccount = async (params: {
		name: string;
		mode: "max" | "console";
		tier: number;
		baseUrl?: string;
	}) => {
		try {
			const result = await api.initAddAccount(params);
			setActionError(null);
			return result;
		} catch (err) {
			setActionError(formatError(err));
			throw err;
		}
	};

	const handleAddDirectAccount = async (params: {
		name: string;
		apiKey: string;
		tier: number;
		baseUrl: string;
	}) => {
		try {
			await api.addDirectAccount(params);
			await loadAccounts();
			setAdding(false);
			setActionError(null);
		} catch (err) {
			setActionError(formatError(err));
			throw err;
		}
	};

	const handleCompleteAccount = async (params: {
		sessionId: string;
		code: string;
	}) => {
		try {
			await api.completeAddAccount(params);
			await loadAccounts();
			setAdding(false);
			setActionError(null);
		} catch (err) {
			setActionError(formatError(err));
			throw err;
		}
	};

	const handleRemoveAccount = (name: string) => {
		setConfirmDelete({ show: true, accountName: name, confirmInput: "" });
	};

	const handleConfirmDelete = async () => {
		if (confirmDelete.confirmInput !== confirmDelete.accountName) {
			setActionError(
				"Account name does not match. Please type the exact account name.",
			);
			return;
		}

		try {
			await api.removeAccount(
				confirmDelete.accountName,
				confirmDelete.confirmInput,
			);
			await loadAccounts();
			setConfirmDelete({ show: false, accountName: "", confirmInput: "" });
			setActionError(null);
		} catch (err) {
			setActionError(formatError(err));
		}
	};

	const handleRename = (account: Account) => {
		setRenameDialog({ isOpen: true, account });
	};

	const handleEdit = (account: Account) => {
		setEditDialog({ isOpen: true, account, isLoading: false });
	};

	const handleSaveEdit = async (accountId: string, updates: AccountUpdates) => {
		setEditDialog((prev) => ({ ...prev, isLoading: true }));

		try {
			// Apply updates sequentially
			if (updates.name) {
				await renameAccount.mutateAsync({
					accountId,
					newName: updates.name,
				});
			}

			if (updates.tier !== undefined) {
				await api.updateAccountTier(accountId, updates.tier);
			}

			if (updates.paused !== undefined) {
				if (updates.paused) {
					await api.pauseAccount(accountId);
				} else {
					await api.resumeAccount(accountId);
				}
			}

			if (updates.rateLimitOverride) {
				await api.updateAccountRateLimit(accountId, updates.rateLimitOverride);
			}

			// Refresh accounts list
			await loadAccounts();

			// Close dialog
			setEditDialog({ isOpen: false, account: null, isLoading: false });
			setActionError(null);
		} catch (err) {
			setActionError(formatError(err));
			setEditDialog((prev) => ({ ...prev, isLoading: false }));
		}
	};

	const handleConfirmRename = async (newName: string) => {
		if (!renameDialog.account) return;

		try {
			await renameAccount.mutateAsync({
				accountId: renameDialog.account.id,
				newName,
			});
			setRenameDialog({ isOpen: false, account: null });
			setActionError(null);
		} catch (err) {
			setActionError(formatError(err));
		}
	};

	const handlePauseToggle = async (account: Account) => {
		try {
			if (account.paused) {
				await api.resumeAccount(account.id);
			} else {
				await api.pauseAccount(account.id);
			}
			await loadAccounts();
		} catch (err) {
			setActionError(formatError(err));
		}
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-muted-foreground">Loading accounts...</p>
				</CardContent>
			</Card>
		);
	}

	const displayError = error ? formatError(error) : actionError;

	return (
		<div className="space-y-4">
			{displayError && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<div className="flex items-center gap-2">
							<AlertCircle className="h-4 w-4 text-destructive" />
							<p className="text-destructive">{displayError}</p>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Accounts</CardTitle>
							<CardDescription>Manage your Claude accounts</CardDescription>
						</div>
						{!adding && (
							<Button onClick={() => setAdding(true)} size="sm">
								<Plus className="mr-2 h-4 w-4" />
								Add Account
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{adding && (
						<AccountAddForm
							onAddAccount={handleAddAccount}
							onCompleteAccount={handleCompleteAccount}
							onAddDirectAccount={handleAddDirectAccount}
							onCancel={() => {
								setAdding(false);
								setActionError(null);
							}}
							onSuccess={() => {
								setAdding(false);
							}}
							onError={setActionError}
						/>
					)}

					<AccountList
						accounts={accounts}
						onPauseToggle={handlePauseToggle}
						onRemove={handleRemoveAccount}
						onRename={handleRename}
						onEdit={handleEdit}
					/>
				</CardContent>
			</Card>

			{confirmDelete.show && (
				<DeleteConfirmationDialog
					accountName={confirmDelete.accountName}
					confirmInput={confirmDelete.confirmInput}
					onConfirmInputChange={(value) =>
						setConfirmDelete({
							...confirmDelete,
							confirmInput: value,
						})
					}
					onConfirm={handleConfirmDelete}
					onCancel={() => {
						setConfirmDelete({
							show: false,
							accountName: "",
							confirmInput: "",
						});
						setActionError(null);
					}}
				/>
			)}

			{renameDialog.isOpen && renameDialog.account && (
				<RenameAccountDialog
					isOpen={renameDialog.isOpen}
					currentName={renameDialog.account.name}
					onClose={() => setRenameDialog({ isOpen: false, account: null })}
					onRename={handleConfirmRename}
					isLoading={renameAccount.isPending}
				/>
			)}

			{editDialog.isOpen && (
				<AccountEditDialog
					isOpen={editDialog.isOpen}
					account={editDialog.account}
					onClose={() =>
						setEditDialog({ isOpen: false, account: null, isLoading: false })
					}
					onSave={handleSaveEdit}
					isLoading={editDialog.isLoading}
				/>
			)}
		</div>
	);
}
