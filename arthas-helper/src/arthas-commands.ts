export interface ArthasCommandContext {
    className: string;
    methodName?: string;
}

export function generateWatchCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `watch ${context.className} ${method} '{params,returnObj,throwExp}' -n 5 -x 3`;
}

export function generateTraceCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `trace ${context.className} ${method} -n 5 --skipJDKMethod false`;
}

export function generateStackCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `stack ${context.className} ${method} -n 5`;
}

export function generateMonitorCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `monitor -c 5 ${context.className} ${method}`;
}

export function generateTtCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `tt -t ${context.className} ${method}`;
}

export function generateJadCommand(context: ArthasCommandContext): string {
    return `jad --source-only ${context.className}`;
}

export function generateScCommand(context: ArthasCommandContext): string {
    return `sc -d ${context.className}`;
}

export function generateSmCommand(context: ArthasCommandContext): string {
    const method = context.methodName || '*';
    return `sm -d ${context.className} ${method}`;
}
