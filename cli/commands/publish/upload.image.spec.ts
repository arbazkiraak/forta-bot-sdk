import provideUploadImage, { UploadImage } from "./upload.image"

describe("uploadImage", () => {
  let uploadImage: UploadImage
  const mockShell = {
    cd: jest.fn(),
    exec: jest.fn()
  } as any
  const mockImageRepositoryUrl = "mock.image.repository"
  const mockImageRepositoryUsername = "username"
  const mockImageRepositoryPassword = "pw"
  const mockAgentId = "agentId"
  const mockImageTag = `${mockAgentId}-intermediate`
  const mockImageDigest = "77af4d6b9913e693e8d0b4b294fa62ade6054e6b2f1ffb617ac955dd63fb0182"
  const mockImageDigestLine = `sha256:${mockImageDigest}`
  const mockImageIpfsCid = "bafybeiggh632bloor6td2xintgpvk674jowua2tyomlzekdwrxfqpdzl5e"
  const mockImageCidLine = `${mockImageIpfsCid}:somethingelse`
  const mockContextPath = '/some/agent/path'

  const resetMocks = () => {
    mockShell.cd.mockReset()
    mockShell.exec.mockReset()
  }

  beforeAll(() => {
    uploadImage = provideUploadImage(mockShell, mockImageRepositoryUrl, 
      mockImageRepositoryUsername, mockImageRepositoryPassword, mockAgentId, mockContextPath)
  })

  beforeEach(() => resetMocks())

  it("throws error if unable to authenticate with image repository", async () => {
    const loginResult = { code: -1, stderr: 'some std err' }
    mockShell.exec.mockReturnValueOnce(loginResult)

    try {
      await uploadImage()
    } catch (e) {
      expect(e.message).toBe(`error authenticating with image repository: ${loginResult.stderr}`)
    }
    
    expect(mockShell.exec).toHaveBeenCalledTimes(1)
    expect(mockShell.exec).toHaveBeenCalledWith(`docker login ${mockImageRepositoryUrl} -u ${mockImageRepositoryUsername} -p ${mockImageRepositoryPassword}`)
  })

  it("throws error if unable to build image", async () => {
    const loginResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(loginResult)
    const buildResult = { code: -1, stderr: `some std err` }
    mockShell.exec.mockReturnValueOnce(buildResult)

    try {
      await uploadImage({imageTagSuffix: "suffix"})
    } catch (e) {
      expect(e.message).toBe(`error building bot image: ${buildResult.stderr}`)
    }

    expect(mockShell.exec).toHaveBeenCalledTimes(2)
    expect(mockShell.exec).toHaveBeenNthCalledWith(2, `docker buildx build --load --platform linux/amd64 --tag ${mockImageTag}-suffix .`)
  })

  it("throws error if unable to tag image", async () => {
    const loginResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(loginResult)
    const buildResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(buildResult)
    const tagResult = { code: -1, stderr: `some std err` }
    mockShell.exec.mockReturnValueOnce(tagResult)

    try {
      await uploadImage()
    } catch (e) {
      expect(e.message).toBe(`error tagging bot image: ${tagResult.stderr}`)
    }

    expect(mockShell.exec).toHaveBeenCalledTimes(3)
    expect(mockShell.exec).toHaveBeenNthCalledWith(3, `docker tag ${mockImageTag} ${mockImageRepositoryUrl}/${mockImageTag}`)
  })

  it("throws error if unable to push image", async () => {
    const loginResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(loginResult)
    const buildResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(buildResult)
    const tagResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(tagResult)
    const pushResult = { code: -1, stderr: `some std err` }
    mockShell.exec.mockReturnValueOnce(pushResult)

    try {
      await uploadImage()
    } catch (e) {
      expect(e.message).toBe(`error pushing bot image: ${pushResult.stderr}`)
    }

    expect(mockShell.exec).toHaveBeenCalledTimes(4)
    expect(mockShell.exec).toHaveBeenNthCalledWith(4, `docker push ${mockImageRepositoryUrl}/${mockImageTag}`)
  })

  it("throws error if unable to pull image tags", async () => {
    const loginResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(loginResult)
    const buildResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(buildResult)
    const tagResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(tagResult)
    const pushResult = { code: 0, grep: jest.fn().mockReturnValueOnce(mockImageDigestLine) }
    mockShell.exec.mockReturnValueOnce(pushResult)
    const pullResult = { code: -1, stderr: `some std err` }
    mockShell.exec.mockReturnValueOnce(pullResult)

    try {
      await uploadImage()
    } catch (e) {
      expect(e.message).toBe(`error pulling tagged bot images: ${pullResult.stderr}`)
    }

    expect(mockShell.exec).toHaveBeenCalledTimes(5)
    expect(mockShell.exec).toHaveBeenNthCalledWith(5, `docker pull -a ${mockImageRepositoryUrl}/${mockImageDigest}`)
  })

  it("uploads agent image to repository and returns image reference", async () => {
    const loginResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(loginResult)
    const buildResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(buildResult)
    const tagResult = { code: 0 }
    mockShell.exec.mockReturnValueOnce(tagResult)
    const pushResult = { code: 0, grep: jest.fn().mockReturnValueOnce(mockImageDigestLine) }
    mockShell.exec.mockReturnValueOnce(pushResult)
    const pullResult = { code: 0, grep: jest.fn().mockReturnValueOnce(mockImageCidLine) }
    mockShell.exec.mockReturnValueOnce(pullResult)

    const imageRef = await uploadImage()

    expect(mockShell.cd).toHaveBeenCalledTimes(1)
    expect(mockShell.cd).toHaveBeenCalledWith(mockContextPath)
    expect(imageRef).toBe(`${mockImageIpfsCid}@sha256:${mockImageDigest}`)
    expect(mockShell.exec).toHaveBeenCalledTimes(5)
  })
})