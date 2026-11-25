import { describe, expect, it } from 'vitest'
import { toAppPath, toLocationPath } from './navigation'

const pagesBase = '/NURSE_TASK_MONITORING/'

describe('화면 주소', () => {
  it('로컬에서는 경로를 그대로 쓴다', () => {
    expect(toAppPath('/ver2', '/')).toBe('/ver2')
    expect(toAppPath('/', '/')).toBe('/')
    expect(toLocationPath('/reports', '/')).toBe('/reports')
    expect(toLocationPath('/', '/')).toBe('/')
  })

  it('GitHub Pages 접두사를 화면 경로와 주소에서 나눈다', () => {
    expect(toAppPath('/NURSE_TASK_MONITORING/', pagesBase)).toBe('/')
    expect(toAppPath('/NURSE_TASK_MONITORING', pagesBase)).toBe('/')
    expect(toAppPath('/NURSE_TASK_MONITORING/ver2', pagesBase)).toBe('/ver2')
    expect(toAppPath('/NURSE_TASK_MONITORING/backup/', pagesBase)).toBe('/backup')
    expect(toLocationPath('/', pagesBase)).toBe('/NURSE_TASK_MONITORING/')
    expect(toLocationPath('/reports', pagesBase)).toBe('/NURSE_TASK_MONITORING/reports')
  })
})
