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
  { label: '许可证', value: 'MIT License' },
];

const securityCapabilities = [
  { icon: 'chat', label: '端到端加密', desc: '采用 Signal 协议保护每条消息' },
  { icon: 'photo_library', label: '媒体加密', desc: '文件和语音端到端加密' },
  { icon: 'vpn_key', label: '密钥交换', desc: 'X3DH 密钥协议' },
  { icon: 'verified_user', label: '安全传输', desc: '全程 TLS 加密传输' },
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

export function AboutPanel(): JSX.Element {
  return (
    <div className="about-panel">
      {/* 头部区域 */}
      <div className="about-panel-hero">
        <div className="about-panel-logo">
          <span className="material-symbols-rounded">shield</span>
        </div>
        <h1 className="about-panel-product-name">Security Chat</h1>
        <p className="about-panel-product-tagline">安全加密即时通讯</p>
        <Badge variant="secondary" className="about-panel-version">
          v{desktopPackageJson.version}
        </Badge>
      </div>

      {/* 版本信息卡片 */}
      <Card className="about-panel-card">
        <CardHeader>
          <CardTitle>产品信息</CardTitle>
        </CardHeader>
        <CardContent className="about-panel-card-content">
          <div className="about-panel-info-list">
            <div className="about-panel-info-row">
              <span className="about-panel-info-label">产品名称</span>
              <span className="about-panel-info-value">{buildItems[0].value}</span>
            </div>
            <div className="about-panel-info-row">
              <span className="about-panel-info-label">桌面版本</span>
              <span className="about-panel-info-value">v{desktopPackageJson.version}</span>
            </div>
            <div className="about-panel-info-row">
              <span className="about-panel-info-label">开源协议</span>
              <span className="about-panel-info-value">{buildItems[2].value}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 安全能力卡片 */}
      <Card className="about-panel-card">
        <CardHeader>
          <CardTitle>安全能力</CardTitle>
        </CardHeader>
        <CardContent className="about-panel-card-content">
          <div className="about-panel-security-grid">
            {securityCapabilities.map((cap) => (
              <div key={cap.label} className="about-panel-security-item">
                <div className="about-panel-security-icon">
                  <span className="material-symbols-rounded">{cap.icon}</span>
                </div>
                <div className="about-panel-security-info">
                  <span className="about-panel-security-label">{cap.label}</span>
                  <span className="about-panel-security-desc">{cap.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 版权声明 */}
      <div className="about-panel-footer">
        <p className="about-panel-copyright">© 2026 Security Chat Team. All rights reserved.</p>
      </div>
    </div>
  );
}
