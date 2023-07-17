import { componentsReducer, propsReducer } from '../../utils'
import actionBar from './actionBar.json'
import actionBarButton from './actionBarButton.json'
import actionBarIcon from './actionBarIcon.json'
import actionSheet from './actionSheet.json'
import addressEdit from './addressEdit.json'
import addressList from './addressList.json'
import area from './area.json'
import backTop from './backTop.json'
import badge from './badge.json'
import barrage from './barrage.json'
import button from './button.json'
import calendar from './calendar.json'
import card from './card.json'
import cascader from './cascader.json'
import cell from './cell.json'
import cellGroup from './cellGroup.json'

export function vant4() {
  const map: any = [
    actionBar,
    actionBarButton,
    actionBarIcon,
    actionSheet,
    addressEdit,
    addressList,
    area,
    backTop,
    badge,
    barrage,
    button,
    calendar,
    card,
    cascader,
    cell,
    cellGroup,
  ]

  return propsReducer(map)
}

export function vant4Components() {
  const map = [
    ['van-action-bar', '动作栏 用于为页面相关操作提供便捷交互'],
    ['van-action-bar-icon', '徽标提示 在 ActionBarIcon 组件上设置 dot 属性后，会在图标右上角展示一个小红点；设置 badge 属性后，会在图标右上角展示相应的徽标'],
    ['van-action-bar-button', '自定义按钮颜色 通过 ActionBarButton 的 color 属性可以自定义按钮的颜色，支持传入 linear-gradient 渐变色。'],
    ['van-action-sheet', '动作面板 底部弹起的模态面板，包含与当前情境相关的多个选项。'],
    ['van-address-edit', '地址编辑 展示地址信息列表。'],
    ['van-area', '省市区选择 省市区三级联动选择，通常与弹出层组件配合使用。'],
    ['van-back-top', '回到顶部 返回页面顶部的操作按钮。'],
    ['van-badge', '徽标 在右上角展示徽标数字或小红点。'],
    ['van-barrage', '弹幕 实现观看视频时弹出的评论性字幕功能。请升级 vant 到 >= 4.4.0 版本来使用该组件。'],
    ['van-button', '按钮 按钮用于触发一个操作，如提交表单。'],
    ['van-calendar', '日历 日历组件用于选择日期或日期区间。'],
    ['van-card', '卡片 商品卡片，用于展示商品的图片、价格等信息。'],
    ['van-cascader', '级联选择 级联选择框，用于多层级数据的选择，典型场景为省市区选择。'],
    ['van-cell', '单元格 单元格为列表中的单个展示项。'],
    ['van-cell-group', '单元格组 单元格为列表中的单个展示项。'],
  ]
  return componentsReducer(map)
}
