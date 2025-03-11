import { Link } from 'react-router'

export default function SuccessfulUserCreated() {
	return (
		<div className="container mx-auto px-8 py-8 text-center">
			<h1 className="mb-4 text-h1">User Created Successfully!</h1>
			<p className="mb-8 text-lg">
				The new user account has been created and is ready to use.
			</p>
			<div className="space-x-4">
				<Link
					to="/admin/add-new-users"
					className="inline-block rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				>
					Create Another User
				</Link>
				<Link
					to="/admin"
					className="inline-block rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				>
					Back to Admin Dashboard
				</Link>
			</div>
		</div>
	)
}
