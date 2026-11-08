import { defineComponent, h } from 'vue';

// 全部图标使用同一坐标系并继承文字颜色。
const paths = {
  Archive:
    'M4 3h16a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2m0 7h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm5 3a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5z',
  ArrowLeft:
    'M10.8 4.7a1 1 0 0 1 0 1.4L6.9 10H21v2H6.9l3.9 3.9a1 1 0 0 1-1.4 1.4l-5.6-5.6a1 1 0 0 1 0-1.4l5.6-5.6a1 1 0 0 1 1.4 0',
  ArrowRight:
    'M13.2 4.7a1 1 0 0 0 0 1.4l3.9 3.9H3v2h14.1l-3.9 3.9a1 1 0 0 0 1.4 1.4l5.6-5.6a1 1 0 0 0 0-1.4l-5.6-5.6a1 1 0 0 0-1.4 0',
  Book: 'M5 3h12a3 3 0 0 1 3 3v13a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2m1 14a1 1 0 0 0 0 2h12v-2zm1-11v8h1.5V6z',
  BookmarkSolid:
    'M6 3h12a1 1 0 0 1 1 1v17a1 1 0 0 1-1.55.83L12 18.2l-5.45 3.63A1 1 0 0 1 5 21V4a1 1 0 0 1 1-1',
  CheckCircleSolid:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1.15 13.77-3.3-3.3 1.42-1.42 1.88 1.88 4.9-4.9 1.42 1.42z',
  Copy: 'M8 3h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1V8a3 3 0 0 0-3-3H8zm-3 4h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2',
  Download:
    'M11 3h2v9.17l2.59-2.59L17 11l-5 5-5-5 1.41-1.42L11 12.17zM4 17h2v2h12v-2h2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  EditPencil: 'M16.7 3.3a2.1 2.1 0 0 1 3 3l-1.4 1.4-3-3zM14.2 5.8l3 3L8 18l-4.6 1.2L4.6 14z',
  Expand: 'M4 3h6v2H6v4H4zm10 0h6v6h-2V5h-4zM4 15h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
  Folder:
    'M3 5.5A2.5 2.5 0 0 1 5.5 3h3.77c.67 0 1.3.27 1.77.73L12.31 5h6.19A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5zm6.25 6.25a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5zm0 3.5a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5z',
  FolderPlus:
    'M3 5.5A2.5 2.5 0 0 1 5.5 3h3.8c.66 0 1.3.26 1.77.73L12.34 5h6.16A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5zm8 4v3h-3v2h3v3h2v-3h3v-2h-3v-3z',
  Group:
    'M8 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7m8.5 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 18a6 6 0 0 1 12 0v1H2zm12.5-5.7a5 5 0 0 1 7.5 4.3V19h-6v-1a7.5 7.5 0 0 0-1.5-5.7',
  HalfMoon: 'M19.9 15.2A8.6 8.6 0 0 1 8.8 4.1a9 9 0 1 0 11.1 11.1',
  HandCard:
    'M8 10V4.5a1.5 1.5 0 0 1 3 0V10h.5V3.5a1.5 1.5 0 0 1 3 0V10h.5V5a1.5 1.5 0 0 1 3 0v6h.5V8a1.5 1.5 0 0 1 3 0v6.5c0 4-2.5 6.5-6.5 6.5h-2c-2.5 0-4-1-5.5-3L4 13.5a1.5 1.5 0 0 1 2.2-2z',
  HelpCircle:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4a3.5 3.5 0 0 1 1.2 6.79c-.31.11-.45.35-.45.71V14h-1.9v-.55c0-1.17.55-1.92 1.7-2.35A1.6 1.6 0 1 0 10.4 9.6H8.5A3.5 3.5 0 0 1 12 6m-1 9.5h2v2h-2z',
  InfoCircleSolid: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1 5h2v2h-2zm0 4h2v6h-2z',
  Journal:
    'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m1 3v12h1.5V6zm3 1v1.5h7V7zm0 4v1.5h7V11z',
  Key: 'M8.5 3a5.5 5.5 0 1 0 3.4 9.82L14 15v2h2v2h2v2h3v-3l-7.18-7.18A5.5 5.5 0 0 0 8.5 3m-1 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3',
  List: 'M4 5h3v3H4zm5 .5h11v2H9zM4 10.5h3v3H4zm5 .5h11v2H9zm-5 5h3v3H4zm5 .5h11v2H9z',
  Lock: 'M7 9V7a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0zm3 3a1.5 1.5 0 0 0-1 2.62V17h2v-2.38A1.5 1.5 0 0 0 12 12',
  LogOut:
    'M5 3h8a2 2 0 0 1 2 2v3h-2V5H5v14h8v-3h2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m12 5 4 4-4 4-1.4-1.4 1.6-1.6H9v-2h8.2l-1.6-1.6z',
  Menu: 'M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z',
  NavArrowDown: 'M5.6 8.6 12 15l6.4-6.4-1.4-1.4-5 5-5-5z',
  NavArrowLeft: 'M14.6 4.6 7.2 12l7.4 7.4 1.4-1.4-6-6 6-6z',
  NavArrowRight: 'M9.4 4.6 8 6l6 6-6 6 1.4 1.4 7.4-7.4z',
  NavArrowUp: 'M5.6 15.4 12 9l6.4 6.4-1.4 1.4-5-5-5 5z',
  Page: 'M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m7 1.8V9h4.2zM7.5 12v1.5h9V12zm0 3.5V17h7v-1.5z',
  Pause: 'M6 4h4v16H6zm8 0h4v16h-4z',
  Play: 'M7 4.5a1 1 0 0 1 1.5-.86l11 6.5a1 1 0 0 1 0 1.72l-11 6.5A1 1 0 0 1 7 17.5z',
  Plus: 'M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8z',
  Refresh:
    'M12 3a9 9 0 0 1 7.5 4H22v5h-5V9h.9A7 7 0 0 0 5.2 10.4l-1.94-.5A9 9 0 0 1 12 3M7 12v3h-.9a7 7 0 0 0 12.7-1.4l1.94.5A9 9 0 0 1 4.5 17H2v-5z',
  Search:
    'M10.5 3a7.5 7.5 0 1 0 4.64 13.39l4.65 4.65 1.41-1.41-4.65-4.65A7.5 7.5 0 0 0 10.5 3m0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11',
  SunLight:
    'M11 2h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.22 5.64l1.42-1.42 2.12 2.12-1.42 1.42zm12.02 12.02 1.42-1.42 2.12 2.12-1.42 1.42zM16.24 6.34l2.12-2.12 1.42 1.42-2.12 2.12zM4.22 18.36l2.12-2.12 1.42 1.42-2.12 2.12zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12',
  Terminal: 'M4.7 5.3 11.4 12l-6.7 6.7-1.4-1.4L8.6 12 3.3 6.7zM12 17h9v2h-9z',
  Trash:
    'M9 3h6l1 2h4v2H4V5h4zm-3 5h12l-.8 11a2 2 0 0 1-2 2H8.8a2 2 0 0 1-2-2zm3 2v8h1.5v-8zm4.5 0v8H15v-8z',
  Upload:
    'M11 16V6.83L8.41 9.42 7 8l5-5 5 5-1.41 1.42L13 6.83V16zM4 17h2v2h12v-2h2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  User: 'M12 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9m0 10a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8',
  UserCircle:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-6.2 12.6a6.5 6.5 0 0 1 12.4 0A8 8 0 0 1 12 20a8 8 0 0 1-6.2-2.4',
  WarningCircleSolid: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1 4h2v7h-2zm0 9h2v2h-2z',
  Xmark:
    'M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4L13.4 12l6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z',
  ZoomIn:
    'M10 3a7 7 0 1 0 4.35 12.48l4.94 4.94 1.41-1.41-4.94-4.94A7 7 0 0 0 10 3m0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10m-1 1.5v2.5H6.5v2H9v2.5h2V11h2.5V9H11V6.5z',
  ZoomOut:
    'M10 3a7 7 0 1 0 4.35 12.48l4.94 4.94 1.41-1.41-4.94-4.94A7 7 0 0 0 10 3m0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10M6.5 9v2h7V9z',
  Shelf:
    'M4 4.75C4 3.78 4.78 3 5.75 3h2.5C9.22 3 10 3.78 10 4.75v13.5c0 .97-.78 1.75-1.75 1.75h-2.5A1.75 1.75 0 0 1 4 18.25zm2.25 1a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm5.25-1c0-.97.78-1.75 1.75-1.75h2.5c.97 0 1.75.78 1.75 1.75v13.5c0 .97-.78 1.75-1.75 1.75h-2.5a1.75 1.75 0 0 1-1.75-1.75zm2.25 1a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zM2.75 21a.75.75 0 0 1 .75-.75h17a.75.75 0 0 1 0 1.5h-17a.75.75 0 0 1-.75-.75m15.95-4.24-1.02-9.58a1.5 1.5 0 0 1 1.33-1.65l.5-.05a1.5 1.5 0 0 1 1.65 1.33l1.02 9.58a1.5 1.5 0 0 1-1.33 1.65l-.5.05a1.5 1.5 0 0 1-1.65-1.33',
  Knowledge:
    'M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m10 0h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m0 7h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1M4 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1m10 4h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1',
  QuestionBank:
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m1.25 4a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm4 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5zm-4 4.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm4 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5zm-4 4.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm4 0a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5z',
  Recommendation:
    'M12 2.5a1 1 0 0 1 .9.56l2.42 4.9 5.4.79a1 1 0 0 1 .55 1.7l-3.9 3.81.92 5.38a1 1 0 0 1-1.45 1.05L12 18.15l-4.84 2.54a1 1 0 0 1-1.45-1.05l.93-5.38-3.91-3.81a1 1 0 0 1 .55-1.7l5.4-.79 2.42-4.9a1 1 0 0 1 .9-.56',
  KnowledgeWorkbench:
    'M12 2.5a5 5 0 0 0-3.5 8.57c.6.6 1 1.32 1.16 2.18h4.68a4.4 4.4 0 0 1 1.16-2.18A5 5 0 0 0 12 2.5m-2.25 12.25h4.5V16a2.25 2.25 0 0 1-4.5 0zM11 18.5h2a1 1 0 0 1-2 0m6.66-4.84 1.47-1.47a1.25 1.25 0 0 1 1.77 1.77l-1.47 1.47-1.77-1.77Zm-1.06 1.06 1.77 1.77-3.53 3.54-2.47.7.7-2.47z',
  QuestionWorkbench:
    'M5 3h10a2 2 0 0 1 2 2v6.5l-5.35 5.35a2 2 0 0 0-.51.85L10.2 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m1.5 4.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5zm0 4a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5zm13.69 1.44a1.25 1.25 0 0 1 1.77 1.77l-1.47 1.47-1.77-1.77zm-2.53 2.53 1.77 1.77-3.54 3.54-2.47.7.7-2.47z',
  BookWorkbench:
    'M4.5 3h9A2.5 2.5 0 0 1 16 5.5v6.75l-4.35 4.35a2 2 0 0 0-.51.85L10.2 21H5a2 2 0 0 1-2-2V4.5A1.5 1.5 0 0 1 4.5 3m2.25 3a.75.75 0 0 0-.75.75v7.5a.75.75 0 0 0 1.5 0v-7.5A.75.75 0 0 0 6.75 6m13.44 6.69a1.25 1.25 0 0 1 1.77 1.77l-1.47 1.47-1.77-1.77zm-2.53 2.53 1.77 1.77-3.54 3.54-2.47.7.7-2.47z',
  Platform:
    'M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M5 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2m10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2'
};

function createIcon(name) {
  return defineComponent({
    name: `MIcon${name}`,
    setup(_, { attrs }) {
      return () =>
        h(
          'svg',
          {
            width: '1em',
            height: '1em',
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            'aria-hidden': 'true',
            focusable: 'false',
            ...attrs
          },
          [
            h('path', {
              d: paths[name],
              'fill-rule': 'evenodd',
              'clip-rule': 'evenodd'
            })
          ]
        );
    }
  });
}

export const Archive = createIcon('Archive');
export const ArrowLeft = createIcon('ArrowLeft');
export const ArrowRight = createIcon('ArrowRight');
export const Book = createIcon('Book');
export const BookmarkSolid = createIcon('BookmarkSolid');
export const CheckCircleSolid = createIcon('CheckCircleSolid');
export const Copy = createIcon('Copy');
export const Download = createIcon('Download');
export const EditPencil = createIcon('EditPencil');
export const Expand = createIcon('Expand');
export const Folder = createIcon('Folder');
export const FolderPlus = createIcon('FolderPlus');
export const Group = createIcon('Group');
export const HalfMoon = createIcon('HalfMoon');
export const HandCard = createIcon('HandCard');
export const HelpCircle = createIcon('HelpCircle');
export const InfoCircleSolid = createIcon('InfoCircleSolid');
export const Journal = createIcon('Journal');
export const Key = createIcon('Key');
export const List = createIcon('List');
export const Lock = createIcon('Lock');
export const LogOut = createIcon('LogOut');
export const Menu = createIcon('Menu');
export const NavArrowDown = createIcon('NavArrowDown');
export const NavArrowLeft = createIcon('NavArrowLeft');
export const NavArrowRight = createIcon('NavArrowRight');
export const NavArrowUp = createIcon('NavArrowUp');
export const Page = createIcon('Page');
export const Pause = createIcon('Pause');
export const Play = createIcon('Play');
export const Plus = createIcon('Plus');
export const Refresh = createIcon('Refresh');
export const Search = createIcon('Search');
export const SunLight = createIcon('SunLight');
export const Terminal = createIcon('Terminal');
export const Trash = createIcon('Trash');
export const Upload = createIcon('Upload');
export const User = createIcon('User');
export const UserCircle = createIcon('UserCircle');
export const WarningCircleSolid = createIcon('WarningCircleSolid');
export const Xmark = createIcon('Xmark');
export const ZoomIn = createIcon('ZoomIn');
export const ZoomOut = createIcon('ZoomOut');
export const Shelf = createIcon('Shelf');
export const Knowledge = createIcon('Knowledge');
export const QuestionBank = createIcon('QuestionBank');
export const Recommendation = createIcon('Recommendation');
export const KnowledgeWorkbench = createIcon('KnowledgeWorkbench');
export const QuestionWorkbench = createIcon('QuestionWorkbench');
export const BookWorkbench = createIcon('BookWorkbench');
export const Platform = createIcon('Platform');
