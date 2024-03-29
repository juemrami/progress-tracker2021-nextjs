import { ChevronRight, CancelIcon } from "./SvgIcons"
import { WithRouterProps } from 'next/dist/client/with-router'
import { withRouter } from 'next/router'
import React, { HTMLAttributes } from 'react'
import { useSearchQuery, useUpdateSearchFilters, useUpdateSearchQuery } from "@client/providers/SearchContext"
type SearchBarProps = {
    className: HTMLAttributes<HTMLDivElement>['className']
    selectedTab: "all" | "recent"
}
const filter_labels = {
    exercise_mechanics: [
        "push",
        "pull"
    ],
    exercise_equipment: [
        'assisted',
        'lever',
        'barbell',
        'body weight',
        'cable',
        'dumbbell',
        'sled',
        'smith',
    ]
}

const SearchBar = ({ className, router, selectedTab }: SearchBarProps & WithRouterProps) => {
    let inputRef = React.useRef<HTMLInputElement>(null)
    const [filters, setFilters] = React.useState(new Map<string, boolean>());
    const [_filters, _setFilters] = React.useState<string[]>([]);
    const updateSearchQuery = useUpdateSearchQuery()
    const updateSearchFilters = useUpdateSearchFilters()
    const currentQuery = useSearchQuery()

    const onTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value
        const should_debounce = selectedTab === "all"
        if (text.length === 0) {
            clearSearch(event)
        }
        updateSearchQuery(text, should_debounce)
    }

    const clearSearch = (event?: React.ChangeEvent<HTMLInputElement>) => {
        updateSearchQuery('', false)
        // setFilters(new Map())
        delete router.query["term"]
        event ? (event.target.value = "") : (inputRef.current && (inputRef.current.value = ""))
    }


    const [showFilters, setShowFilters] = React.useState(false);
    const areFiltersEmpty = [...filters.values()].every((value) => !value)

    const getFilterCategory = (key: string) => {
        switch (key) {
            case "exercise_equipment":
                return "Equipment"
            case "exercise_mechanics":
                return "Mechanics"
        }
    };

    return (
        <div id="search-bar" className={className}>
            {/* <span> {router.asPath}</span> */}
            <fieldset className="relative max-h-10 flex flex-col items-center justify-center mb-3">
                < input
                    id="exercise-search-input"
                    type="text"
                    inputMode="search"
                    onFocus={(e) => {
                        e.target.value && e.target.select();
                    }}
                    onKeyUp={(e) => {
                        if (e.key == "Enter") {
                            (document.activeElement as HTMLElement).blur();
                        };
                    }}
                    defaultValue={router.query.term as string || ''}
                    ref={inputRef}
                    onChange={(e) => {
                        onTermChange(e)
                    }}
                    placeholder="Search..."
                    className="w-full rounded-2xl border transition-all duration-400 bg-transparent px-2 py-1 text-base focus:rounded-md focus:outline-none"
                />
                <button
                    id="clear-search-button"
                    onClick={(e) => {
                        clearSearch()
                        setFilters(new Map())
                    }}
                    className={`absolute  right-3 ${!currentQuery && areFiltersEmpty && "hidden"}`}>
                    <CancelIcon />
                </button>
            </fieldset>
            <div id="show-filter-toggle"
                onClick={() => setShowFilters(prev => !prev)} className="-mt-1 flex w-max pr-2 text-[.9rem] items-center">

                <ChevronRight className={`rotate 0 ${showFilters && "rotate-90"} transition-all ease-in duration-[450] h-4 font-bold rounded-lg`} />

                <span>{!showFilters ? "show" : "hide"} filters</span>
            </div>
            <div id='filters'
                className={`flex flex-col space-y-0 /border border-rose-600 transition-all duration-[500] ease-out overflow-hidden ${!showFilters ? 'max-h-0' : 'max-h-24'}`}>
                {Object.entries(filter_labels).map((filter, index) => {
                    const [filter_key, filter_value] = filter;
                    return (
                        <form className="flex //border items-start" key={index} onChange={e => { }}>
                            <span id='filter-category' className="text-sm text-text.secondary mr-4 mt-[.2rem]">
                                {getFilterCategory(filter_key)}:
                            </span>
                            <fieldset id={`tag-list-${getFilterCategory(filter_key)}`} className="flex flex-wrap gap-x-1">
                                {/* <input id="" type={"radio"} className="appearance-none" name="filter" value="null">
                                </input> */}
                                {filter_value.map((filter_name, index) => {
                                    return (
                                        <label key={index} htmlFor={filter_name.replace(' ', '-')}>
                                            <input id={filter_name.replace(' ', '-')}
                                                className="peer appearance-none"
                                                type={"checkbox"}
                                                name={"filter"}
                                                value={filter_name}
                                                checked={filters.get(filter_name) || false}
                                                onChange={(e) => {
                                                    const newMap = new Map([...filters, [filter_name, !filters.get(filter_name)]])
                                                    updateSearchFilters && updateSearchFilters(Array.from(newMap.entries()).filter(([_, v]) => v).map(([k, _]) => k))
                                                    setFilters(newMap)
                                                }} />
                                            <span className="whitespace-nowrap rounded-md bg-white/90 px-2 text-xs font-bold capitalize text-black peer-checked:bg-theme peer-checked:text-white">{filter_name}</span>
                                        </label>
                                    )
                                }
                                )}
                            </fieldset>
                        </form>
                    );
                })}
            </div>
            <div className={`border-b w-full transition-all duration-300 my-1 mx-auto ease-out ${showFilters ? "w-full" : "w-[10%]"}`} />
        </div >
    )
}

export default withRouter<SearchBarProps & WithRouterProps>(SearchBar)