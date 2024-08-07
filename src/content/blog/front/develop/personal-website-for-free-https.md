---
title: 个人网站如何白嫖 HTTPS
excerpt: 总所周知，HTTP 协议主要用于客户端和服务端的通信，但它本身也有一定缺点。那么 HTTPS 是如果保证安全性的呢？
publishDate: '2022-07-05'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 个人网站如何白嫖 HTTPS
---

## 什么是 HTTPS

总所周知，HTTP 协议主要用于客户端和服务端的通信，但它本身也有一定缺点

- 明文传输，内容可能被监听
- 不能验证通信方的身份，可能遭遇伪装
- 无法证明报文完整性，报文可能被篡改

从架构的角度来说 “没有什么是加一层不能解决的” （狗头），所以 HTTPS 也就应运而生了

HTTPS 是 HTTP 协议加 SSL（Secure Socket Layer，安全套接层）和 TLS（Transport Layer Security，安全层传输协议）协议的统称，从名称就可以看出，“两个 S” 相关的协议目的就是为了保证通信的安全性。通信方式也就变成了：HTTP → SSL / TLS → TCP / IP

那么 HTTPS 是如果保证安全性的呢，这里简单介绍一下

- 将对称加密的密钥用非对称加密的公钥进行加密，接收方在收到后，使用非对称加密的私钥进行解密得到对称加密的密钥，然后双方就可以通过对称加密的密钥进行沟通了
- 但是这种加密传输的方式，一样也可能遭受中间人攻击，为了解决这个问题，需要一个权威、安全、可靠的第三方来证明通信方的身份，这里就要用到机构颁发的 **CA 证书**
- 使用 CA 证书自带的 Hash 算法对证书内容 Hash 化得到一个摘要，再用 CA 证书的私钥加密，得到一个数字签名。当接收方收到证书后，使用相同的 Hash 算法生成消息摘要，再用公钥对数字签名解密，两者一对比，就知道有没有被别人篡改过了

所以这里可以看到配置 HTTPS 的**关键在于 CA 证书**，而提供这种证明服务的机构必然是收费的（不然怎么保持中立呢），而且收费一般还不低，但是只要努力找一下，也是有白嫖 CA 证书的机会的。

（顺便说一句，HTTPS 也不是绝对安全的，如果没有做到全站 HTTPS 的话，一样可能存在安全风险）

## 如何白嫖 HTTPS 证书

我使用的是 [Letsencrypt](https://letsencrypt.org/) ，一个免费好用的 HTTPS 证书服务商。毕竟阿里云一个证书续费 2000 多，一个个人网站续上几年都够换台 Macbook 了，对于个人网站来说真的没必要

我使用的阿里云的服务器，操作系统是 Alibaba Cloud Linux，本质也是对 CentOS 的封装（CentOS 2021 年 12 月 31 号就停止维护了），所以下面我简单介绍一下如何在 Alibaba Cloud Linux（CentOS）配置 HTTPS 证书

### 安装 Certbot 和 snap

Letsencrypt 官方提供一个 [Certbot](https://certbot.eff.org/pages/about) 工具，用于快速生成证书。dnf 是 CentOS 内置的 Shell 软件包管理器，先使用 `dnf --version` 命令确定 dnf 工具可用, 再增加 epel 源，并更新 dnf 仓库

```Bash
dnf install <https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm>
dnf upgrade
```

接下来使用 dnf 安装 snap（一个软件集合，类似 App Store）

```Bash
dnf install snapd -y # 安装snap
systemctl enable --now snapd.socket # 设置开机自启
ln -s /var/lib/snapd/snap /snap # 设置 snap 软链接
```

安装好 snap 后，更新 snap 快照、安装 Certbot 并设置软连接

```shell
# 更新快照
snap install core
snap refresh core

snap install --classic certbot # 安装 certbot
ln -s /snap/bin/certbot /usr/bin/certbot # 设置 certbot 软链接
```

![Image.png (1220×164)](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Image.png)

### 配置 HTTPS 证书

接下来使用 certbot 配置 https 证书，首先可以检查一下服务器有没有打开 HTTPS 需要的 443 端口的防火墙，如果没有打开的话需要提前设置一下（我一开始配置的时候就因为没开 443 的防火墙，导致证书一直下载不下来）

```Bash
# 检查 443 端口防火墙是否打开，返回的是 yes 的话说明是开启的
firewall-cmd --query-port=443/tcp

# 开启 443 端口的防火墙
firewall-cmd --add-port=3306/tcp --permanent
firewall-cmd --reload
```

再输入 `nginx -V` 命令检查 nginx 是否有配置 SSL 参数，如果看到 `--with-http_ssl_module` 参数说明是配置好了，否则需要重新安装、编译添加 SSL 模块

```Bash
# 进入源码包
cd /home/nginx-1.20.2/
# 操作 ssl 编译（prefix 是 nginx 目录前缀）
./configure --prefix=/usr/local/nginx --with-http_stub_status_module --with-http_ssl_module`
# 执行 make 命令（此时不要执行 make install，否则会覆盖）
make
# 备份原有 nginx 配置
cp /usr/local/nginx/sbin/nginx /usr/local/nginx/sbin/nginx.bak
# 停止 nginx
nginx -s stop
# 将编译好的 nginx 覆盖掉原有的 nginx
cd /home/nginx-1.20.2/
cp ./objs/nginx /usr/local/nginx/sbin/

# 启动 nginx
nginx
# 查看模块是否加载成功（大写的 V）
nginx -V
```

配置好 SSL 模块的情况

![截屏2022-07-03_20.11.52.png](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/2022-07-03_20.11.52.png)

设置好上面两个步骤之后，就可以执行 `certbot —nginx` 命令扫描 nginx 所有配置，会要求选择选择需要配置的域名，

- 输入电子邮箱，用于紧急续签和安全通知
- 是否同意服务条款，输入 y 同意
- 是否接受新闻邮件，输入 n 不同意
- 只要输入域名对应的序号即可，下图就是我的域名，如果有多个的话需要以逗号分隔即可

![截屏2022-07-03_20.44.16.png](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/2022-07-03_20.44.16.png)

然后 certbot 会下载证书到 `/etc/letsencrypt/live/[具体域名]` 目录

![截屏2022-07-03_20.47.06.png](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/2022-07-03_20.47.06.png)

证书下载好的同时，certbot 也会修改 nginx.conf 配置文件的内容，下面看一下 certbot 修改了哪些内容（带有 `# managed by Certbot` 的内容都是 certbot 增加的，无须手动再次修改）

```Bash
# 监听的端口由原来的 80 端口变为 443 端口
listen 443 ssl; # managed by Certbot

# 导入 HTTPS 下载好的证书相关文件
ssl_certificate /etc/letsencrypt/live/www.wujieli.top/fullchain.pem; # managed by Certbot
ssl_certificate_key /etc/letsencrypt/live/www.wujieli.top/privkey.pem; # managed by Certbot
include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

# 在非 https 访问的情况下，使用 301 重定向至 https 目录
server {
if ($host = www.wujieli.top) {
    return 301 https://$host$request_uri;
} # managed by Certbot
```

最后可以使用 SSLChecker 网站检查一下 HTTPS 是否配置成功，如果全是绿色就代表大功告成了，这时候访问域名的时候就可以看到访问是安全的了

![截屏2022-07-03_20.59.51.png](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/2022-07-03_20.59.51.png)
