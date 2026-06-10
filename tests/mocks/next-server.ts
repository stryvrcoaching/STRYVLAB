// Minimal next/server stubs for Vitest (Node environment)

export class NextRequest extends Request {
  public nextUrl: URL
  public cookies: any
  public geo: any
  public ip: string
  public page: any

  constructor(input: string | URL, init?: RequestInit) {
    super(input, init)
    this.nextUrl = new URL(typeof input === 'string' ? input : input.toString())
    this.cookies = {}
    this.geo = {}
    this.ip = '127.0.0.1'
    this.page = {}
  }
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    return new NextResponse(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  }
}
