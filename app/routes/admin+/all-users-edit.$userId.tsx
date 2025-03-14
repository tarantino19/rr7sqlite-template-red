import { Link, redirect } from 'react-router'
import { Form, useLoaderData, useActionData } from 'react-router'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { Button } from '#app/components/ui/button.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { useIsPending } from '#app/utils/misc.tsx'
import { z } from 'zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { EmailSchema, UsernameSchema } from '#app/utils/user-validation.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const EditUserSchema = z.object({
	email: EmailSchema,
	username: UsernameSchema,
	name: z.string().min(1, 'Name is required'),
	roles: z.array(z.string()).default(['user']),
})

export async function loader({
	request,
	params,
}: {
	request: Request
	params: { userId: string }
}) {
	await requireUserWithRole(request, 'admin')

	// Fetch all available roles from the database
	const availableRoles = await prisma.role.findMany({
		select: {
			name: true,
			description: true,
		},
		orderBy: {
			name: 'asc',
		},
	})

	const user = await prisma.user.findUnique({
		where: { id: params.userId },
		select: {
			id: true,
			email: true,
			username: true,
			name: true,
			roles: {
				select: {
					name: true,
				},
			},
		},
	})

	if (!user) {
		throw new Response('Not Found', { status: 404 })
	}

	return { user, availableRoles }
}

export async function action({
	request,
	params,
}: {
	request: Request
	params: { userId: string }
}) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()

	const rawData = {
		email: formData.get('email'),
		username: formData.get('username'),
		name: formData.get('name'),
		roles: formData.getAll('roles'),
	}

	const result = EditUserSchema.safeParse(rawData)

	if (!result.success) {
		return {
			errors: result.error.flatten().fieldErrors,
			status: 400,
		}
	}

	const { email, username, name, roles } = result.data

	// Check if email is taken by another user
	const existingEmail = await prisma.user.findFirst({
		where: {
			email: email.toLowerCase(),
			NOT: { id: params.userId },
		},
		select: { id: true },
	})

	if (existingEmail) {
		return {
			errors: {
				email: ['This email is already taken'],
			},
			status: 400,
		}
	}

	// Check if username is taken by another user
	const existingUsername = await prisma.user.findFirst({
		where: {
			username: username.toLowerCase(),
			NOT: { id: params.userId },
		},
		select: { id: true },
	})

	if (existingUsername) {
		return {
			errors: {
				username: ['This username is already taken'],
			},
			status: 400,
		}
	}

	await prisma.user.update({
		where: { id: params.userId },
		data: {
			email: email.toLowerCase(),
			username: username.toLowerCase(),
			name,
			roles: {
				set: [], // Remove all current roles
				connect: roles.map((name) => ({ name })), // Add new roles
			},
		},
	})

	return redirect('/admin/all-users')
}

export default function EditUser() {
	const { user } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	return (
		<div className="container mx-auto px-8 py-8">
			<h1 className="mb-8 text-h1">Edit User</h1>

			<Form method="POST" className="space-y-6">
				<div className="mb-8">
					<label htmlFor="email" className="block text-sm font-medium">
						Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						defaultValue={user.email}
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
						defaultValue={user.username}
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
						defaultValue={user.name ?? ''}
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
					<label htmlFor="roles" className="block text-sm font-medium">
						Roles
					</label>
					<select
						id="roles"
						name="roles"
						multiple
						defaultValue={user.roles.map((r) => r.name)}
						className="mb-2 mt-2 block h-20 w-full rounded-md border border-gray-300 px-3 py-2"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div className="flex gap-4">
					<StatusButton
						type="submit"
						status={isPending ? 'pending' : 'idle'}
						disabled={isPending}
					>
						{isPending ? 'Saving...' : 'Save Changes'}
					</StatusButton>
					<Button variant="outline" asChild>
						<Link to="/admin/all-users">Cancel</Link>
					</Button>
				</div>
			</Form>
		</div>
	)
}
