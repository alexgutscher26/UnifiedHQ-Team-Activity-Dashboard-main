import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'

/**
 * Renders an access denied page for unauthorized users.
 */
export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <ShieldX className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">Access Denied</CardTitle>
                    <CardDescription>
                        You don't have permission to access this page. This area is restricted to administrators only.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <Button asChild className="w-full">
                            <Link href="/">
                                <Home className="h-4 w-4 mr-2" />
                                Go to Dashboard
                            </Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full">
                            <Link href="javascript:history.back()">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Go Back
                            </Link>
                        </Button>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                        If you believe this is an error, please contact your administrator.
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}