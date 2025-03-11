import { redirect, useActionData } from 'react-router'
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

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const AddNewUserSchema = z.object({
	email: EmailSchema,
	username: UsernameSchema,
	password: PasswordSchema,
	name: z.string().min(1, 'Name is required'),
	roles: z.array(z.string()).default(['user']),
})

export async function loader({ request }: { request: Request }) {
	await requireUserWithRole(request, 'admin')
	return {}
}

export async function action({ request }: { request: Request }) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()

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

	return redirect('/admin/successful-user-created')
}

export default function AddNewUserRoute() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	return (
		<div className="container mx-auto px-8 py-8">
			<h1 className="mb-8 text-h1">Add New User</h1>
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
					<label htmlFor="roles" className="block text-sm font-medium">
						Roles
					</label>
					<select
						id="roles"
						name="roles"
						multiple
						defaultValue={['user']}
						className="mb-2 mt-2 block h-20 w-full rounded-md border border-gray-300 px-3 py-2"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
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
