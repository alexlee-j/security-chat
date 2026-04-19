import desktopPackageJson from '../../../package.json';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type AboutSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const buildItems = [
  { label: '产品名称', value: 'Security Chat' },
  { label: '桌面版本', value: desktopPackageJson.version },
  { label: '技术栈', value: 'Tauri 2.x / React 18 / Vite / shadcn-ui' },
  { label: '仓库', value: 'security-chat-signal-refactor' },
  { label: '许可证', value: 'MIT License' },
];

export function AboutSheet({ open, onOpenChange }: AboutSheetProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5 text-left">
            <SheetTitle>关于</SheetTitle>
            <p className="text-sm text-muted-foreground">
              版本、版权、许可证与构建信息
            </p>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">当前构建</CardTitle>
                  <Badge variant="secondary">Desktop</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {buildItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-right font-medium">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">构建说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>本 surface 仅展示桌面端产品闭环相关的版本与构建信息。</p>
                <Separator />
                <p>调用层与协议层未在关于页里暴露调试细节，避免把实现噪声带入产品面。</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">版权声明</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>© 2026 Security Chat Team. All rights reserved.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
