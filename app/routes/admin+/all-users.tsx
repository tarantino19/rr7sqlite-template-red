import { Link, useLoaderData } from 'react-router'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { Button } from '#app/components/ui/button.tsx'
import { type SEOHandle } from '@nasa-gcn/remix-seo'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: { request: Request }) {
	await requireUserWithRole(request, 'admin')

	const users = await prisma.user.findMany({
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
		orderBy: {
			createdAt: 'desc',
		},
	})

	return { users }
}

export default function AllUsers() {
	const { users } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto px-8 py-8">
			<div className="mb-8 flex items-center justify-between">
				<h1 className="text-h1">All Users</h1>
				<Button asChild>
					<Link to="/admin/add-new-users">Add New User</Link>
				</Button>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full table-auto border-collapse">
					<thead>
						<tr className="bg-muted">
							<th className="border px-4 py-2 text-left">Name</th>
							<th className="border px-4 py-2 text-left">Username</th>
							<th className="border px-4 py-2 text-left">Email</th>
							<th className="border px-4 py-2 text-left">Roles</th>
							<th className="border px-4 py-2 text-center">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => (
							<tr key={user.id} className="border-b hover:bg-muted/50">
								<td className="border px-4 py-2">{user.name ?? '-'}</td>
								<td className="border px-4 py-2">{user.username}</td>
								<td className="border px-4 py-2">{user.email}</td>
								<td className="border px-4 py-2">
									{user.roles.map((role) => role.name).join(', ')}
								</td>
								<td className="border px-4 py-2 text-center">
									<div className="flex justify-center gap-2">
										<Button asChild variant="outline" size="sm">
											<Link to={`/admin/all-users-edit/${user.id}`}>Edit</Link>
										</Button>
										<Button asChild variant="outline" size="sm">
											<Link to={`/users/${user.username}`}>View Profile</Link>
										</Button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{users.length === 0 ? (
				<div className="mt-8 text-center text-muted-foreground">
					No users found
				</div>
			) : null}
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<div className="container mx-auto px-8 py-8">
			<h1 className="text-h1 text-red-500">Error</h1>
			<p>There was an error loading the users. Please try again later.</p>
		</div>
	)
}
