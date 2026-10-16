import React, { useState } from 'react';
import { FaStar, FaArrowUp, FaArrowDown, FaTimes, FaPen, FaCheck } from 'react-icons/fa';
import { groupFavs, FAV_MAX, ALIAS_MAX } from '../../rules/riot';

/* 별명 칸. 칠 때마다 저장하면 글자마다 서버로 간다 - 칸을 벗어나거나 엔터에 저장 */
export const AliasInput = ({ value, onSave, className = '' }) => {
  const [draft, setDraft] = useState(value || '');
  return (
    <input
      className={`riot-alias-input ${className}`}
      value={draft}
      maxLength={ALIAS_MAX}
      placeholder="별명 (실명 등)"
      aria-label="별명"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value || '');
          e.currentTarget.blur();
        }
      }}
    />
  );
};

/* 즐겨찾기. 평소에는 별명으로 묶어서(본계정 · 부계정이 한 칸),
   편집을 누르면 한 줄에 하나씩 - 순서 · 별명 · 지우기 */
const FavPanel = ({ favs, onSearch }) => {
  const [editing, setEditing] = useState(false);

  if (!favs.loggedIn) {
    return (
      <p className="riot-muted riot-fav-hint">
        <FaStar /> 로그인하면 자주 보는 사람을 즐겨찾기(최대 {FAV_MAX}명)에 별명과 함께 저장할 수 있어요.
      </p>
    );
  }
  if (!favs.ready) return null;
  if (favs.list.length === 0) {
    return (
      <p className="riot-muted riot-fav-hint">
        <FaStar /> 전적에서 ☆를 누르면 즐겨찾기에 들어와요. 별명을 같게 적으면 부계정끼리 묶여요.
      </p>
    );
  }

  return (
    <section className="riot-panel">
      <h2 className="riot-h">
        <FaStar /> 즐겨찾기
        <em className="riot-h-sub">
          {favs.list.length}/{FAV_MAX}
        </em>
        <button
          type="button"
          className={`riot-fav-edit ${editing ? 'is-on' : ''}`}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? (
            <>
              <FaCheck /> 완료
            </>
          ) : (
            <>
              <FaPen /> 편집
            </>
          )}
        </button>
      </h2>

      {editing ? (
        <ol className="riot-fav-rows">
          {favs.list.map((f, i) => (
            <li key={f.id}>
              <span className="riot-fav-order">
                <button
                  type="button"
                  onClick={() => favs.move(i, -1)}
                  disabled={i === 0}
                  aria-label={`${f.id} 위로`}
                >
                  <FaArrowUp />
                </button>
                <button
                  type="button"
                  onClick={() => favs.move(i, 1)}
                  disabled={i === favs.list.length - 1}
                  aria-label={`${f.id} 아래로`}
                >
                  <FaArrowDown />
                </button>
              </span>
              <span className="riot-fav-id">{f.id}</span>
              <AliasInput value={f.alias} onSave={(a) => favs.setAlias(f.id, a)} />
              <button
                type="button"
                className="riot-fav-del"
                onClick={() => favs.remove(f.id)}
                aria-label={`${f.id} 즐겨찾기에서 빼기`}
              >
                <FaTimes />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="riot-fav-groups">
          {groupFavs(favs.list).map((g) => (
            <div key={g.ids[0]} className={`riot-fav-group ${g.ids.length > 1 ? 'is-multi' : ''}`}>
              {g.alias && <strong className="riot-fav-alias">{g.alias}</strong>}
              {g.ids.map((id, i) => (
                <button key={id} type="button" className="riot-fav-id-btn" onClick={() => onSearch(id)}>
                  {/* 묶음의 두 번째부터는 부계정이라고 알려준다 */}
                  {g.ids.length > 1 && <em>{i === 0 ? '본' : '부'}</em>}
                  {id}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <p className="riot-muted">별명이 같은 계정은 한 칸으로 묶여요. 위에 있는 쪽이 본계정이에요.</p>
      )}
    </section>
  );
};

export default FavPanel;
