import React, { useState } from 'react';
import { champIconUrl, itemIconUrl } from '../../server/riot';
import { laneIconOf, positionName } from '../../rules/riot';

/* 매치 목록과 게임 상세가 같이 쓰는 작은 조각들 */

export const Champ = ({ champs, name, size = 'md', level }) => {
  const c = champs?.byId.get(name);
  const url = champIconUrl(champs?.version, name);
  return (
    <span className={`riot-champ-icon is-${size}`} title={c?.name || name}>
      {url && <img src={url} alt={c?.name || name || ''} loading="lazy" />}
      {level != null && <b className="riot-champ-level">{level}</b>}
    </span>
  );
};

export const champName = (champs, name) => champs?.byId.get(name)?.name || name || '?';

export const Items = ({ items, version, small }) => (
  <span className={`riot-items ${small ? 'is-small' : ''}`}>
    {items.map((it, i) => {
      const url = itemIconUrl(version, it);
      return url ? <img key={i} src={url} alt="" loading="lazy" /> : <i key={i} />;
    })}
  </span>
);

/* 처음엔 몇 개만, '더 보기'로 펼친다. 휴대폰은 세로로 길어서 옆 칸
   (숙련도 · 도전 과제)이 매치 목록을 한참 밀어낸다 */
export const FOLD = 3;
export const useFold = (total, limit = FOLD) => {
  const [open, setOpen] = useState(false);
  const more = total > limit;
  return {
    shown: open || !more ? total : limit,
    open,
    button: more ? (
      <button type="button" className="riot-fold" onClick={() => setOpen((v) => !v)}>
        {open ? '접기' : `${total - limit}개 더 보기`}
      </button>
    ) : null,
  };
};

/* 라인 아이콘 + 글자. 아이콘만 두면 서폿 · 원딜을 헷갈린다 */
export const Lane = ({ pos, iconOnly }) => {
  const url = laneIconOf(pos);
  if (!url) return iconOnly ? <i className="riot-lane is-blank" /> : null;
  return (
    <span className={`riot-lane ${iconOnly ? 'is-icon' : ''}`} title={positionName(pos)}>
      <img src={url} alt="" />
      {!iconOnly && positionName(pos)}
    </span>
  );
};
