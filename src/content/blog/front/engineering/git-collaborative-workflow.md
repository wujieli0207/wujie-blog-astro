---
title: git 协作工作流方案
excerpt: 团队协作开发过程中，git 必不可少，由于我之前使用的都是 SVN 作为代码管理工具，所以在切换成 git 的分布式版本管理工具之后，多少还是需要习惯的过程。另外由于最近两周 git 分支管理和协作上出过几次问题，所以也趁这个机会梳理一下 git 协作的工作流程
publishDate: '2022-11-06'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: git 协作工作流方案
---

团队协作开发过程中，git 必不可少，由于我之前使用的都是 SVN 作为代码管理工具，所以在切换成 git 的分布式版本管理工具之后，多少还是需要习惯的过程。另外由于最近两周 git 分支管理和协作上出过几次问题，所以也趁这个机会梳理一下 git 协作的工作流程

## 定义分支和使用原则

我们主要的分支类型会有 4 个，分别是：master、release、feature、hotifx，另外还会有一个不常用的 dev 分支，下面分别介绍一下分支的定义和使用规则

master 分支：生产主分支

- master 分支代码始终保持与生产环境代码保持一致
- 上线分支始终从 master 分支拉取
- 上线后需及时将上线分支合并至 master 分支，合并代码时需要打一个 tag 标记当前版本

release 分支：每个上线版本分支

- release 命名原则：release-版本号-上线日期，例如 release-v2.6.0-20220715 表示在 2022 年 7 月 15 日上线的 2.6.0 版本
- 版本号定义原则 `x.y.z`
  - 主版本 x：项目大版本升级或者是有 breaking change 的内容
  - 次版本 y：日常迭代或者新增功能
  - 修订版本 z：通常是 bug 修复
- 当上线计划发生变化，有需求无法在该版本上线时，将 git 本地及远程 release 分支删除，重新基于 master 分支拉取新的 release 分支，将需上线的 feature 需求分支合并至新的 release 分支
- 测试验证完成后，运维将测试环境已经过测试的程序包直接发布至准生产及生产环境
- 发布完成后由开发负责人将 release 分支代码合并至 master 分支
- **禁止将 release/xx 分支代码反向 merge 到 feature/xx 分支**

feature 分支：功能开发分支

- 命名参考：feature/功能 xxx
- 测试时将 feature 合并到需要上线 release 分支中进行发布测试
- 测试环境出现 bug 时在 feature/xx 分支修复后提交 merge request 到对应的 release 分支
- feature 分支开发完成后，开发人员提交 Merge Request 给到管理人员，管理人员检查代码后进行 Merge 操作

hotfix 分支： 生产 bug 修复分支

- 命名参考：hotfix-v1.2.3-20221026（版本号定义同 release 分支）
- 从 master 直接拉取，修复通过测试并上线后直接合并到 master 分支

dev 分支：测试用分支

- 使用场景：多条 release 分支需要并行测试时使用，创建 dev 分支并将需要测试的 release 或者 hotfix 分支合并到 dev 分支进行测试
- 使用完成后即可删除，下次需要使用时再通过 dev 创建即可

## 工作流场景

在确定好分支和使用原则之后，下面来看在这个 git 工作流程下的开发场景示例

### 场景一：项目初始化

假设我要已经在本地开发好了项目的第一个版本，此时我需要将项目在 github 做初始化

```shell
git init # 初始化 git 仓库
git add . # 把文件提交至暂存区
git commit -m "project init" # 将暂存区文件提交至本地分支
git branch -M master # 当前分支重命名为 master 分支
# 连接 git 仓库，此时连接的是我的演示仓库
git remote add origin https://github.com/wujieli0207/git-flow-demo.git
# 标记 tag 并将代码提交至远端仓库
git tag v0.0.1
git push -u origin master
git push origin --tags
```

经过以上的操作之后，可以看到我们的项目项目已经初始化完成

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211051711126.png)

### 场景二：短期迭代

现在 master 分支代码正在生产环境运行，我们收到一个两周之后的要上线的需求，需求可以被拆分为两个开发任务并由两个不同的同事开发，这个时候需要创建三个分支，分别是 release-v0.1.0-20221019、feature/task-a、feature/task-b

当两个 feature 分支开发完成后，将代码合并到 release 分支进行测试，测试完成后将 release-v0.1.0-20221019 这个分支代码发布至生产环境，发布完成后将 release 代码合并至 master 分支，并且删除两个 feature 开发分支

```shell
# 需求开发前创建需要的分支
git checkout -b feautre/task-a master
git checkout -b feautre/task-b master
git checkout -b release-v0.1.0-20221019 master

# 需求开发完成后合并 feature 代码
git checkout release-v0.1.0-20221019
git merge --no-ff feautre/task-a
git merge --no-ff feautre/task-b

# 测试完成后发布合并 release 代码
git checkout master
git merge --no-ff release-v0.1.0-20221019

# 标记此次版本为 0.1.0
git tag v0.1.0
git push origin master
git push origin --tags
```

在这次发布完成后，可以看到此时的工作流

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211061129249.png)

### 场景三：长线项目和短期迭代场景并行

接下来我们收到了一个项目需求，开发周期是两个月但上线时间暂不确定，另外还有常规的每两周上线的迭代任务

在这个场景下，对于项目需求会创建一个 release-v1.0.0 的分支作为上线分支，在上线时间最终确认后将分支名称修改为 release-v1.0.0-[上线日期]，对于常规迭代版本同样还是按照上线时间 release 分支。除此之外还需要解决两个 release 分支在同一个环境进行测试的问题，这个时候就需要创建一个 dev 分支，然后将两个 release 分支分别合并进入 dev 分支，再将 dev 分支发布至测试环境进行测试

```shell
# 创建待上线的分支
git checkout -b release-v1.0.0 master
git checkout -b release-v0.2.0 master
git checkout -b dev master
```

在测试过程过程中需要将两个分支合并进入 dev 分支进行测试（这里为了演示简化了分支，开发过程中一定是按照在 feature 上开发，然后再合并进入 release 的过程进行的）

```shell
# 合并两个 release 分支进入 dev 分支
git merge --no-ff release-v0.2.0
git merge --no-ff release-v1.0.0
```

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211061133141.png)

当迭代任务和项目任务上线之后，再分别将上线的 release 合并进入 master 并标记 tag，注意 release 分支上线前修改分支名为发布日期

```shell
# 合并迭代任务的 release 分支
git checkout release-v0.2.0
git branch -m release-v0.2.0-20221120
git checkout master
git merge --no-ff release-v0.2.0-20221120
git tag v0.2.0

# 合并项目任务操作类似，就不再演示
```

此时的工作流如图所示，dev 分支如果不再使用的话可以直接删除，后续需要的时候从 master 直接再拉取

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211061139449.png)

### 场景四：生产 bug 修复

现在在生产运行过程中出现了 bug 需要紧急修复，这个时候就需要使用到 hotfix 分支，我们从 master 分支创建一个 hotfix-v1.0.1-20221106 的分支，在本地修复后并发布上线后，直接合并到 master 分支

```shell
git checkout -b hotfix-v1.0.1-20221106 master
# 修复 bug 后发布 hotfix 后
git checkout master
git merge --no-ff hotfix-v1.0.1-20221106
git tag v1.0.1
```

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211061142918.png)

### 场景五：某些需求推迟上线

对于需求推迟上线主要会分为两种处理情况

- release 中某个 feature 推迟上线。这时只要重新创建一个新的 release 分支，把需要上线的分支合并进入新分支并作简单的回归测试即可
- feature 中的某个需求点推迟上线。这个时候就需要使用到 `git cherry-pick <commitId>` 这个命令，把单独需要上线的分支拿出来放入新的 feature，在把 feature 合并入上线 release 分支进行相同的流程

### 场景六：生产回退版本

当上线版本发生重大问题的时候，我们往往先要会退到上一个发布版本，由于我们采用的是 docker 部署的镜像发布，所以只要把上一个版本打包的镜像重新在发布一遍就好。而对于生产环境的代码，这个时候我们每次上线后标记的 tag 就可以派上用场了，比如我们要会退到 v1.0.0 版本可以这样操作

```shell
git show v1.0.0 # 查看 v1.0.0 版本的 commitId
git reset --hard <commitId> # 会退到指定版本
```

## 一些工作流使用经验

### 统一的 commit 提交规范

对于 commit 的信息在团队使用统一的规范。目前比较通用的规范是采用 Angular 的提交规范格式，然后使用 husky 和 commitlint 对代码进行提交前规范检查，这样能够最大程度保证代码一致性。另外在 code review 的时候，也能根据 header 信息快速信息筛选，比如 style、docs 的 header 的提交信息在合并代码的时候检查一下就可以了，在 code review 的时候就可以直接跳过，提高效率。同时附上我们使用的 commit header

```shell
  - feat ：feature，新增功能，能够让用户觉察到的变化
 - fix：bug fix，修复 bug
  - style ：代码样式调整，对逻辑无影响，比如为符合 eslint 要求修改代码格式
  - docs：文档、注释更新
  - refactor：重构（不包括 bug 修复、功能新增），如文件、变量重命名、代码抽象为函数，消除魔法数字
  - perf ：性能提升
  - test：添加、修改测试用例
  - build ：构建流程、外部依赖变更（如升级 npm 包、修改 webpack 配置等）
  - chore：对构建过程或辅助工具和库的更改（不影响源文件、测试用例）
  - ci：修改 CI 配置、脚本
  - revert：回滚 commit
  - wip：开发中
  - mod：不确定分类的修改
  - types：类型修改
```

另外对于 commit 的颗粒度，我建议还是在 feature 功能模块下，每完成一个具体的功能点（比如：查询）就提交一个 commit，这样在 code review 的时候不会有一个 commit 改动特别多就不想看的情况，另外如果发生需要代码会退或者 `cherry-pick` 的时候，也能做到精准操作

### merge 添加 --no-ff 参数

`git merge` 命令中使用 `--no-ff` 参数目的是让提交纪录更清晰。`--no-ff` 含义是禁止快进式合并，如果我们没有使用这个参数的话，git 在合并分支时只是简单的把指针移动到下游分支，比如下图左侧的效果，release 分支在 master 分支的下游，所以直接移动 master 指针指向 release

而如果使用了 `--no-ff` 这个参数，git 会生成一条新的提交纪录，这样就有一个清晰的 commit 历史纪录，可以更好的进行代码溯源和版本回退这些场景

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202211060732553.png)

### 尽量不使用 git revert 命令

为什么没有使用 `git revert` 命令，在最初制定分支和使用原则的时候，对于要上线的 release 分支，要求是重新创建一条新的 release 分支而不是在原有的 release 分支上使用 `git revert` 命令回退，原因有如下两点

- release 分支并没有上线，重新创建 release 分支可以保证提交纪录更简单，而不是混入一个 revert 纪录
- `git revert` 分为两种情况：一种是常规的 commit，这个就是正常的回退。第二种是 merge commit，这种情况下 merge commit 会包含两个 parent commit，代表该 merge commit 是从哪两个 commit 合并过来的，所以在合并的时候需要加上 `-m` 选项以代表这次 revert 的是一个 merge commit，很容易操作不当导致代码被覆盖的情况

基于以上这两点原因，并且还有一次 revert merge commit 操作导致了代码的丢失的惨痛教训，所以原则上就不再使用 `git revert` 这个命令了。但其实只要操作足够清晰，`git revert` 这个命令也是可以正常使用的

以上就是我们现在使用的 git 协作规范和流程，当然还有很多复杂的场景没有考虑到，所以还有相当大的提升空间
