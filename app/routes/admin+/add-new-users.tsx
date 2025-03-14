import { redirect, useActionData, useLoaderData } from 'react-router'
import { Form } from 'react-router'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { getPasswordHash } from '#app/utils/auth.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	EmailSchema,
	PasswordSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Button } from '#app/components/ui/button.tsx'
import { useState, useRef, useEffect } from 'react'
import { useUser } from '#app/utils/user.ts'
import { Icon } from '#app/components/ui/icon.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

type ActionData =
	| {
			errors: {
				email?: string[]
				username?: string[]
				name?: string[]
				password?: string[]
				roles?: string[]
				role?: string[]
			}
			status: 400
	  }
	| {
			status: 'success'
			formType: 'role' | 'user' | 'delete-role'
			errors?: Record<string, string>
	  }
	| undefined

const AddNewUserSchema = z.object({
	email: EmailSchema,
	username: UsernameSchema,
	password: PasswordSchema,
	name: z.string().min(1, 'Name is required'),
	roles: z.array(z.string()).default(['user']),
})

export async function loader({ request }: { request: Request }) {
	await requireUserWithRole(request, 'admin')

	const availableRoles = await prisma.role.findMany({
		select: {
			name: true,
		},
		orderBy: {
			name: 'asc',
		},
	})

	return { availableRoles }
}

export async function action({
	request,
}: {
	request: Request
}): Promise<ActionData> {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'create-role') {
		const roleName = formData.get('roleName')?.toString().toLowerCase()

		if (!roleName) {
			return {
				errors: {
					role: ['Role name is required'],
				},
				status: 400,
			}
		}

		// Check if role already exists
		const existingRole = await prisma.role.findUnique({
			where: { name: roleName },
			select: { name: true },
		})

		if (existingRole) {
			return {
				errors: {
					role: ['This role already exists'],
				},
				status: 400,
			}
		}

		// Create new role
		await prisma.role.create({
			data: {
				name: roleName,
			},
		})

		return { status: 'success', formType: 'role' }
	}

	if (intent === 'delete-role') {
		const roleName = formData.get('roleName')?.toString()

		if (!roleName) {
			return {
				errors: {
					role: ['Role name is required'],
				},
				status: 400,
			}
		}

		// Don't allow deletion of 'admin' and 'user' roles
		if (roleName === 'admin' || roleName === 'user') {
			return {
				errors: {
					role: ['Cannot delete system roles'],
				},
				status: 400,
			}
		}

		// Delete the role
		await prisma.role.delete({
			where: { name: roleName },
		})

		return { status: 'success', formType: 'delete-role' }
	}

	// Original user creation logic...
	const rawData = {
		email: formData.get('email'),
		username: formData.get('username'),
		password: formData.get('password'),
		name: formData.get('name'),
		roles: formData.getAll('roles'),
	}

	const result = AddNewUserSchema.safeParse(rawData)

	if (!result.success) {
		return {
			errors: result.error.flatten().fieldErrors,
			status: 400,
		}
	}

	const { email, username, password, name, roles } = result.data

	// Check if user with email already exists
	const existingEmail = await prisma.user.findUnique({
		where: { email: email.toLowerCase() },
		select: { id: true },
	})

	if (existingEmail) {
		return {
			errors: {
				email: ['A user with this email already exists'],
			},
			status: 400,
		}
	}

	// Check if user with username already exists
	const existingUsername = await prisma.user.findUnique({
		where: { username: username.toLowerCase() },
		select: { id: true },
	})

	if (existingUsername) {
		return {
			errors: {
				username: ['A user with this username already exists'],
			},
			status: 400,
		}
	}

	const newUser = await prisma.user.create({
		data: {
			email: email.toLowerCase(),
			username: username.toLowerCase(),
			name,
			password: {
				create: {
					hash: await getPasswordHash(password),
				},
			},
			roles: {
				connect: roles.map((name) => ({ name })),
			},
		},
		select: {
			username: true,
		},
	})

	redirect('/admin/successful-user-created')
}

export default function AddNewUserRoute() {
	const { availableRoles } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [showRoleForm, setShowRoleForm] = useState(false)
	const roleFormRef = useRef<HTMLFormElement>(null)
	const user = useUser()
	const isAdmin = user.roles.some((role) => role.name === 'admin')

	// Effect to handle successful role creation
	useEffect(() => {
		if (actionData?.status === 'success' && actionData.formType === 'role') {
			if (roleFormRef.current) {
				roleFormRef.current.reset()
			}
			setShowRoleForm(false)
		}
	}, [actionData])

	return (
		<div className="container mx-auto px-8 py-8">
			<div className="mb-8 flex items-center justify-between">
				<h1 className="text-h1">Add New User</h1>
				<Button
					variant="outline"
					onClick={() => setShowRoleForm(!showRoleForm)}
				>
					{showRoleForm ? 'Hide Role Form' : 'Add New Role'}
				</Button>
			</div>

			{showRoleForm && (
				<Form
					ref={roleFormRef}
					method="POST"
					className="mb-8 space-y-6 border-b pb-8"
				>
					<input type="hidden" name="intent" value="create-role" />
					<div>
						<label htmlFor="roleName" className="block text-sm font-medium">
							Role Name
						</label>
						<input
							id="roleName"
							name="roleName"
							type="text"
							required
							className="mb-2 mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</div>
					<Button type="submit">Create Role</Button>
					{actionData?.errors?.role ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors.role[0]}
						</div>
					) : null}
				</Form>
			)}

			<Form method="POST" className="space-y-6">
				<div className="mb-8">
					<label htmlFor="email" className="block text-sm font-medium">
						Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						className="mb-2 mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
					/>
					{actionData?.errors?.email ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors.email[0]}
						</div>
					) : null}
				</div>

				<div className="mb-8">
					<label htmlFor="username" className="block text-sm font-medium">
						Username
					</label>
					<input
						id="username"
						name="username"
						type="text"
						autoComplete="username"
						required
						className="mb-2 mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
					/>
					{actionData?.errors?.username ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors.username[0]}
						</div>
					) : null}
				</div>

				<div className="mb-8">
					<label htmlFor="name" className="block text-sm font-medium">
						Name
					</label>
					<input
						id="name"
						name="name"
						type="text"
						autoComplete="name"
						required
						className="mb-2 mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
					/>
					{actionData?.errors?.name ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors.name[0]}
						</div>
					) : null}
				</div>

				<div className="mb-8">
					<label htmlFor="password" className="block text-sm font-medium">
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						required
						className="mb-2 mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
					/>
					{actionData?.errors?.password ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors.password[0]}
						</div>
					) : null}
				</div>

				<div className="mb-8">
					<label className="mb-2 block text-sm font-medium">Roles</label>
					<div className="space-y-2">
						{availableRoles.map((role) => (
							<div
								key={role.name}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div className="flex items-center">
									<input
										type="checkbox"
										id={`role-${role.name}`}
										name="roles"
										value={role.name}
										defaultChecked={role.name === 'user'}
										className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<label
										htmlFor={`role-${role.name}`}
										className="ml-2 block text-sm text-gray-900"
									>
										{role.name}
									</label>
								</div>
								{isAdmin && role.name !== 'admin' && role.name !== 'user' && (
									<Form method="POST" className="inline">
										<input type="hidden" name="intent" value="delete-role" />
										<input type="hidden" name="roleName" value={role.name} />
										<button
											type="submit"
											className="text-red-500 hover:text-red-700"
											title={`Delete ${role.name} role`}
										>
											<Icon name="cross-1" />
										</button>
									</Form>
								)}
							</div>
						))}
					</div>
					{actionData?.errors?.role ? (
						<div className="mt-1 text-sm text-red-500">
							{actionData.errors?.role[0]}
						</div>
					) : null}
				</div>

				<div className="mt-8">
					<StatusButton
						type="submit"
						status={isPending ? 'pending' : 'idle'}
						disabled={isPending}
						className="w-full"
					>
						{isPending ? 'Creating New User...' : 'Create User'}
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}
